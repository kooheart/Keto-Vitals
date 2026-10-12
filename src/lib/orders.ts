import crypto from "node:crypto";
import { Prisma, type Order, type OrderStatus } from "@prisma/client";
import { db } from "./db";
import { AppError, badRequest, conflict, notFound } from "./errors";
import { loadLines, priceLines } from "./cart";
import { canTransition } from "./order-status";
import { getGateway, isRazorpayConfigured, type PaymentGateway } from "./razorpay";
import { checkPincode } from "./shipping";
import { syncProductDerived } from "./catalog";
import { sendEmail } from "./email";
import { formatINR } from "./money";
import type { AddressInput } from "./validation";

export function newOrderNumber(now = new Date()) {
  const d = now.toISOString().slice(2, 10).replace(/-/g, "");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from(crypto.randomBytes(6), (b) => alphabet[b % alphabet.length]).join("");
  return `KV-${d}-${rand}`;
}

export type PlaceOrderInput = {
  cartId: string;
  idempotencyKey: string;
  userId?: string | null;
  email: string;
  phone: string;
  address: AddressInput;
  paymentMethod: "RAZORPAY" | "COD";
  couponCode?: string | null;
  note?: string;
};

export type PlaceOrderResult = {
  order: Order;
  /** Present only for online payments that still need to be completed in the browser. */
  razorpay?: { keyId: string; razorpayOrderId: string; amountPaise: number };
  duplicate: boolean;
};

export async function placeOrder(input: PlaceOrderInput, gateway?: PaymentGateway): Promise<PlaceOrderResult> {
  // 1) Idempotency: a repeated submit returns the original order instead of creating a second one.
  const prior = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: true } });
  if (prior) {
    if (prior.userId && prior.userId !== (input.userId ?? null)) throw conflict("Duplicate checkout key.");
    return { order: prior, duplicate: true, razorpay: await pendingRazorpay(prior, prior.payments) };
  }

  // 2) Re-read everything from the database. Nothing price-related comes from the browser.
  const lines = await loadLines(input.cartId);
  if (!lines.length) throw badRequest("Your cart is empty.", "empty_cart");
  const bad = lines.find((l) => l.issue);
  if (bad) throw conflict(`${bad.name} (${bad.variantName}): ${bad.issue}. Please update your cart.`, "stock_changed", { variantId: bad.variantId });

  const svc = await checkPincode(input.address.pincode);
  if (!svc.serviceable) throw badRequest(svc.reason, "not_serviceable");

  const { pricing, coupon, settings } = await priceLines(lines, {
    couponCode: input.couponCode,
    userId: input.userId,
    email: input.email,
    shippingRatePaise: svc.ratePaise,
    cod: input.paymentMethod === "COD",
  });
  if (coupon && !coupon.ok) throw badRequest(coupon.reason, "coupon_invalid");

  if (input.paymentMethod === "COD") {
    if (!settings["cod.enabled"] || !svc.codAvailable) throw badRequest("Cash on Delivery is not available for this order.", "cod_unavailable");
    if (pricing.totalPaise > settings["cod.maxOrderPaise"]) throw badRequest(`Cash on Delivery is available up to ${formatINR(settings["cod.maxOrderPaise"])}.`, "cod_limit");
  } else if (!settings["payments.razorpay.enabled"] || !isRazorpayConfigured() && !gateway) {
    throw badRequest("Online payment is currently unavailable. Please choose another method.", "payments_unavailable");
  }

  // 3) One transaction: reserve stock atomically, snapshot prices, record coupon use.
  let order: Order;
  try {
    order = await db.$transaction(async (tx) => {
      for (const l of lines) {
        const r = await tx.inventory.updateMany({ where: { variantId: l.variantId, quantity: { gte: l.quantity } }, data: { quantity: { decrement: l.quantity } } });
        if (r.count === 0) throw conflict(`${l.name} (${l.variantName}) just went out of stock.`, "stock_changed", { variantId: l.variantId });
      }
      if (coupon?.ok) {
        const c = coupon.coupon;
        const r = await tx.coupon.updateMany({
          where: { id: c.id, isActive: true, ...(c.usageLimit != null ? { usedCount: { lt: c.usageLimit } } : {}) },
          data: { usedCount: { increment: 1 } },
        });
        if (r.count === 0) throw badRequest("This coupon has been fully redeemed.", "coupon_invalid");
      }
      const isCod = input.paymentMethod === "COD";
      const o = await tx.order.create({
        data: {
          number: newOrderNumber(),
          userId: input.userId ?? null,
          email: input.email.toLowerCase(),
          phone: input.phone,
          status: isCod ? "PLACED" : "PENDING_PAYMENT",
          paymentMethod: input.paymentMethod,
          paymentStatus: isCod ? "COD_PENDING" : "CREATED",
          idempotencyKey: input.idempotencyKey,
          shippingAddress: input.address as unknown as Prisma.InputJsonValue,
          subtotalPaise: pricing.subtotalPaise,
          discountPaise: pricing.discountPaise,
          shippingPaise: pricing.shippingPaise,
          codFeePaise: pricing.codFeePaise,
          taxPaise: pricing.taxPaise,
          totalPaise: pricing.totalPaise,
          couponCode: coupon?.ok ? coupon.coupon.code : null,
          customerNote: input.note?.slice(0, 500),
          items: {
            create: lines.map((l, i) => ({
              productId: l.productId,
              variantId: l.variantId,
              name: l.name,
              variantName: l.variantName,
              sku: l.sku,
              imageUrl: l.imageUrl,
              unitPricePaise: l.unitPricePaise,
              mrpPaise: l.mrpPaise,
              quantity: l.quantity,
              lineTotalPaise: pricing.lineNetPaise[i], // net of discount
              gstRate: l.gstRate,
            })),
          },
          events: { create: { status: isCod ? "PLACED" : "PENDING_PAYMENT", note: isCod ? "Order placed (Cash on Delivery)" : "Awaiting online payment" } },
          payments: { create: { provider: isCod ? "cod" : "razorpay", status: isCod ? "COD_PENDING" : "CREATED", amountPaise: pricing.totalPaise } },
        },
      });
      if (coupon?.ok) await tx.couponRedemption.create({ data: { couponId: coupon.coupon.id, orderId: o.id, userId: input.userId ?? null, email: input.email.toLowerCase() } });
      await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });
      await tx.cart.update({ where: { id: input.cartId }, data: { couponCode: null } });
      if (isCod) await bumpSold(tx, lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), 1);
      for (const pid of new Set(lines.map((l) => l.productId))) await syncProductDerived(pid, tx);
      return o;
    });
  } catch (e) {
    // Two concurrent submits with the same key: the loser hits the unique constraint → return the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const o = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { payments: true } });
      if (o) return { order: o, duplicate: true, razorpay: await pendingRazorpay(o, o.payments) };
    }
    throw e;
  }

  if (input.paymentMethod === "COD") {
    void sendOrderConfirmation(order.id);
    return { order, duplicate: false };
  }

  // 4) Online payment: create the provider order server-side. If that fails, release the held stock.
  try {
    const rz = await createProviderOrder(order, gateway);
    return { order, duplicate: false, razorpay: rz };
  } catch (e) {
    await cancelOrder(order.id, { reason: "Could not start online payment", actorId: null }).catch((err) => console.error("rollback failed", err));
    throw e;
  }
}

async function createProviderOrder(order: Order, gateway?: PaymentGateway) {
  const gw = gateway ?? getGateway();
  const payment = await db.payment.findFirstOrThrow({ where: { orderId: order.id, provider: "razorpay" }, orderBy: { createdAt: "desc" } });
  const rz = await gw.createOrder({ amountPaise: order.totalPaise, receipt: order.number, notes: { orderId: order.id } });
  await db.payment.update({ where: { id: payment.id }, data: { providerOrderId: rz.id } });
  return { keyId: process.env.RAZORPAY_KEY_ID ?? "", razorpayOrderId: rz.id, amountPaise: order.totalPaise };
}

async function pendingRazorpay(order: Order, payments: { provider: string; status: string; providerOrderId: string | null }[]) {
  if (order.status !== "PENDING_PAYMENT") return undefined;
  const p = payments.find((x) => x.provider === "razorpay" && x.providerOrderId && x.status !== "PAID");
  return p ? { keyId: process.env.RAZORPAY_KEY_ID ?? "", razorpayOrderId: p.providerOrderId!, amountPaise: order.totalPaise } : undefined;
}

/** Re-open payment for an order that is still PENDING_PAYMENT (e.g. user closed the Razorpay window). */
export async function retryPayment(orderId: string, owner: { userId?: string | null; email?: string }, gateway?: PaymentGateway) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order || (order.userId ? order.userId !== owner.userId : order.email !== owner.email?.toLowerCase())) throw notFound("Order not found");
  if (order.status !== "PENDING_PAYMENT") throw conflict("This order is not awaiting payment.");
  const existing = await pendingRazorpay(order, order.payments);
  if (existing) return existing;
  await db.payment.create({ data: { orderId: order.id, provider: "razorpay", status: "CREATED", amountPaise: order.totalPaise } });
  return createProviderOrder(order, gateway);
}

async function bumpSold(tx: Prisma.TransactionClient, items: { productId: string | null; quantity: number }[], sign: 1 | -1) {
  for (const it of items) if (it.productId) await tx.product.update({ where: { id: it.productId }, data: { soldCount: { increment: sign * it.quantity } } });
}

export type ApplyPaymentInput = {
  providerOrderId: string;
  providerPaymentId: string;
  /** Amount (paise) reported by the *trusted* source (Razorpay API or signed webhook). */
  amountPaise: number;
};

/**
 * Idempotently marks a payment as paid. Safe to call from the browser-verify path and
 * the webhook path concurrently: only one caller wins the `status != PAID` update.
 */
export async function applyPaymentSuccess(input: ApplyPaymentInput): Promise<{ order: Order; alreadyProcessed: boolean }> {
  const payment = await db.payment.findUnique({ where: { providerOrderId: input.providerOrderId }, include: { order: true } });
  if (!payment) throw notFound("Unknown payment order");
  if (payment.amountPaise !== input.amountPaise) {
    console.error(`[payments] amount mismatch order=${payment.orderId} expected=${payment.amountPaise} got=${input.amountPaise}`);
    throw new AppError(409, "Payment amount does not match the order.", "amount_mismatch");
  }
  const outcome = await db.$transaction(async (tx) => {
    const won = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "PAID" } },
      data: { status: "PAID", providerPaymentId: input.providerPaymentId, paidAt: new Date(), failureReason: null },
    });
    if (won.count === 0) return { order: payment.order, first: false };
    const o = await tx.order.findUniqueOrThrow({ where: { id: payment.orderId }, include: { items: true } });
    if (o.status === "PENDING_PAYMENT") {
      const upd = await tx.order.update({ where: { id: o.id }, data: { status: "PLACED", paymentStatus: "PAID", events: { create: { status: "PLACED", note: "Payment received" } } } });
      await bumpSold(tx, o.items, 1);
      return { order: upd, first: true };
    }
    // Paid after the order was cancelled/expired: record it and flag for a manual refund.
    const upd = await tx.order.update({ where: { id: o.id }, data: { paymentStatus: "PAID", events: { create: { status: o.status, note: "Payment received after order was " + o.status.toLowerCase() + " — refund required" } } } });
    return { order: upd, first: false };
  });
  if (outcome.first) void sendOrderConfirmation(outcome.order.id);
  return { order: outcome.order, alreadyProcessed: !outcome.first };
}

export async function markPaymentFailed(providerOrderId: string, providerPaymentId: string | null, reason: string | null) {
  // Never downgrade a successful payment.
  await db.payment.updateMany({
    where: { providerOrderId, status: { not: "PAID" } },
    data: { status: "FAILED", failureReason: reason?.slice(0, 300) ?? "Payment failed" },
  });
}

/** Verify a browser-reported payment against Razorpay itself before trusting it. */
export async function confirmBrowserPayment(
  p: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  verifySig: (o: string, pay: string, sig: string) => boolean,
  gateway?: PaymentGateway,
) {
  if (!verifySig(p.razorpayOrderId, p.razorpayPaymentId, p.signature)) throw new AppError(400, "Payment signature could not be verified.", "bad_signature");
  const gw = gateway ?? getGateway();
  const rp = await gw.fetchPayment(p.razorpayPaymentId);
  if (rp.order_id !== p.razorpayOrderId) throw new AppError(400, "Payment does not belong to this order.", "order_mismatch");
  if (rp.status === "failed") {
    await markPaymentFailed(p.razorpayOrderId, p.razorpayPaymentId, rp.error_description ?? null);
    throw new AppError(402, "Your payment failed. You have not been charged — please try again.", "payment_failed");
  }
  if (rp.status !== "captured") {
    // 'authorized' / 'created': not final. The webhook will finalise it; don't mark paid.
    return { status: "pending" as const, order: await db.payment.findUnique({ where: { providerOrderId: p.razorpayOrderId } }).then((x) => x && db.order.findUnique({ where: { id: x.orderId } })) };
  }
  const { order } = await applyPaymentSuccess({ providerOrderId: p.razorpayOrderId, providerPaymentId: rp.id, amountPaise: rp.amount });
  return { status: "paid" as const, order };
}

export async function cancelOrder(orderId: string, opts: { reason: string; actorId: string | null }) {
  return db.$transaction(async (tx) => {
    const o = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, redemptions: true } });
    if (!o) throw notFound("Order not found");
    if (!canTransition(o.status, "CANCELLED")) throw conflict(`An order that is ${o.status.toLowerCase().replace("_", " ")} cannot be cancelled.`, "bad_transition");
    if (!o.stockReleasedAt) {
      for (const it of o.items) if (it.variantId) await tx.inventory.updateMany({ where: { variantId: it.variantId }, data: { quantity: { increment: it.quantity } } });
    }
    if (o.status !== "PENDING_PAYMENT") await bumpSold(tx, o.items, -1);
    for (const r of o.redemptions) {
      await tx.coupon.update({ where: { id: r.couponId }, data: { usedCount: { decrement: 1 } } });
      await tx.couponRedemption.delete({ where: { id: r.id } });
    }
    const upd = await tx.order.update({
      where: { id: o.id },
      data: { status: "CANCELLED", cancelReason: opts.reason, stockReleasedAt: new Date(), events: { create: { status: "CANCELLED", note: opts.reason, actorId: opts.actorId } } },
    });
    for (const pid of new Set(o.items.map((i) => i.productId).filter(Boolean) as string[])) await syncProductDerived(pid, tx);
    return upd;
  });
}

export async function updateOrderStatus(orderId: string, to: OrderStatus, opts: { actorId: string; note?: string; carrier?: string; trackingNumber?: string }) {
  const o = await db.order.findUnique({ where: { id: orderId } });
  if (!o) throw notFound("Order not found");
  if (!canTransition(o.status, to)) throw conflict(`Cannot move an order from ${o.status} to ${to}.`, "bad_transition");
  if (to === "CANCELLED") return cancelOrder(orderId, { reason: opts.note || "Cancelled by store", actorId: opts.actorId });
  if (to === "SHIPPED" && !opts.trackingNumber && !o.trackingNumber) throw badRequest("Enter a tracking number before marking as shipped.", "tracking_required");
  const data: Prisma.OrderUpdateInput = { status: to, events: { create: { status: to, note: opts.note, actorId: opts.actorId } } };
  if (opts.carrier) data.carrier = opts.carrier;
  if (opts.trackingNumber) data.trackingNumber = opts.trackingNumber;
  if (to === "DELIVERED" && o.paymentMethod === "COD") data.paymentStatus = "PAID"; // cash collected
  if (to === "REFUNDED") data.paymentStatus = "REFUNDED";
  const upd = await db.order.update({ where: { id: orderId }, data });
  if (to === "SHIPPED") void sendEmail({ to: o.email, subject: `Your order ${o.number} has shipped`, text: `Your order ${o.number} is on its way.\nCarrier: ${upd.carrier ?? "-"}\nTracking: ${upd.trackingNumber ?? "-"}` });
  return upd;
}

/** Cancel unpaid online orders older than `olderThanMinutes` and return their stock. */
export async function releaseExpiredOrders(olderThanMinutes = 30) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const stale = await db.order.findMany({ where: { status: "PENDING_PAYMENT", createdAt: { lt: cutoff }, payments: { none: { status: "PAID" } } }, select: { id: true } });
  let released = 0;
  for (const s of stale) {
    try {
      await cancelOrder(s.id, { reason: "Payment not completed in time", actorId: null });
      released++;
    } catch (e) {
      console.error("release failed", s.id, (e as Error).message);
    }
  }
  return released;
}

export async function sendOrderConfirmation(orderId: string) {
  try {
    const o = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!o) return;
    const lines = o.items.map((i) => `• ${i.name} (${i.variantName}) × ${i.quantity} — ${formatINR(i.lineTotalPaise)}`).join("\n");
    await sendEmail({
      to: o.email,
      subject: `Order ${o.number} confirmed`,
      text: `Thank you for your order!\n\nOrder: ${o.number}\n${lines}\n\nShipping: ${formatINR(o.shippingPaise)}\nTotal: ${formatINR(o.totalPaise)}\nPayment: ${o.paymentMethod === "COD" ? "Cash on Delivery" : "Paid online"}\n\nTrack your order: ${process.env.APP_URL}/track?order=${o.number}`,
    });
  } catch (e) {
    console.error("confirmation email failed", (e as Error).message);
  }
}
