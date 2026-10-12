import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { addItem, getOrCreateCart } from "@/lib/cart";
import { applyPaymentSuccess, confirmBrowserPayment, placeOrder, releaseExpiredOrders, retryPayment } from "@/lib/orders";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { POST as webhook } from "@/app/api/webhooks/razorpay/route";
import { FakeGateway, address, makeProduct, resetDb, uid } from "./helpers";

beforeEach(resetDb);
const sig = (o: string, p: string) => crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${o}|${p}`).digest("hex");

async function pendingOrder(gw: FakeGateway, stock = 5) {
  const { variant } = await makeProduct({ price: 500, stock });
  const cart = await getOrCreateCart({ guestToken: `g-${uid()}` });
  await addItem(cart.id, variant.id, 1);
  const r = await placeOrder({ cartId: cart.id, idempotencyKey: `k-${uid()}-${"y".repeat(12)}`, email: "a@b.co", phone: "9876543210", address: address(), paymentMethod: "RAZORPAY" }, gw);
  return { ...r, variant, rzOrder: r.razorpay!.razorpayOrderId };
}

describe("payment verification", () => {
  it("marks paid only after a valid signature AND a captured payment fetched from the gateway", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    gw.addPayment("pay_1", rzOrder, "captured");
    const r = await confirmBrowserPayment({ razorpayOrderId: rzOrder, razorpayPaymentId: "pay_1", signature: sig(rzOrder, "pay_1") }, verifyCheckoutSignature, gw);
    expect(r.status).toBe("paid");
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(o).toMatchObject({ status: "PLACED", paymentStatus: "PAID" });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).providerPaymentId).toBe("pay_1");
  });

  it("rejects a forged signature and leaves the order unpaid", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    gw.addPayment("pay_1", rzOrder, "captured");
    await expect(confirmBrowserPayment({ razorpayOrderId: rzOrder, razorpayPaymentId: "pay_1", signature: "deadbeef" }, verifyCheckoutSignature, gw)).rejects.toMatchObject({ code: "bad_signature" });
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("does not trust a valid signature if the gateway says the payment failed or is not captured", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    gw.addPayment("pay_f", rzOrder, "failed");
    await expect(confirmBrowserPayment({ razorpayOrderId: rzOrder, razorpayPaymentId: "pay_f", signature: sig(rzOrder, "pay_f") }, verifyCheckoutSignature, gw)).rejects.toMatchObject({ code: "payment_failed" });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
    gw.addPayment("pay_a", rzOrder, "authorized");
    const r = await confirmBrowserPayment({ razorpayOrderId: rzOrder, razorpayPaymentId: "pay_a", signature: sig(rzOrder, "pay_a") }, verifyCheckoutSignature, gw);
    expect(r.status).toBe("pending");
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("rejects a payment that belongs to a different Razorpay order or has a different amount", async () => {
    const gw = new FakeGateway();
    const a = await pendingOrder(gw);
    gw.addPayment("pay_x", "order_other", "captured", 1);
    await expect(confirmBrowserPayment({ razorpayOrderId: a.rzOrder, razorpayPaymentId: "pay_x", signature: sig(a.rzOrder, "pay_x") }, verifyCheckoutSignature, gw)).rejects.toMatchObject({ code: "order_mismatch" });
    gw.addPayment("pay_y", a.rzOrder, "captured", 100); // underpaid
    await expect(confirmBrowserPayment({ razorpayOrderId: a.rzOrder, razorpayPaymentId: "pay_y", signature: sig(a.rzOrder, "pay_y") }, verifyCheckoutSignature, gw)).rejects.toMatchObject({ code: "amount_mismatch" });
    expect((await db.order.findUniqueOrThrow({ where: { id: a.order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("prevents duplicate processing: concurrent verify + webhook confirm once, bump sales once", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder, variant } = await pendingOrder(gw);
    const total = order.totalPaise;
    const results = await Promise.all(Array.from({ length: 4 }, () => applyPaymentSuccess({ providerOrderId: rzOrder, providerPaymentId: "pay_dup", amountPaise: total })));
    expect(results.filter((r) => !r.alreadyProcessed)).toHaveLength(1);
    expect((await db.product.findUniqueOrThrow({ where: { id: variant.productId } })).soldCount).toBe(1);
    expect(await db.orderEvent.count({ where: { orderId: order.id, note: "Payment received" } })).toBe(1);
  });

  it("the same Razorpay payment id cannot be applied to two different orders", async () => {
    const gw = new FakeGateway();
    const a = await pendingOrder(gw);
    const b = await pendingOrder(gw);
    await applyPaymentSuccess({ providerOrderId: a.rzOrder, providerPaymentId: "pay_same", amountPaise: a.order.totalPaise });
    await expect(applyPaymentSuccess({ providerOrderId: b.rzOrder, providerPaymentId: "pay_same", amountPaise: b.order.totalPaise })).rejects.toThrow();
    expect((await db.order.findUniqueOrThrow({ where: { id: b.order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("flags a payment that arrives after the order was cancelled for refund", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    await db.order.update({ where: { id: order.id }, data: { createdAt: new Date(Date.now() - 3600_000) } });
    expect(await releaseExpiredOrders(30)).toBe(1);
    await applyPaymentSuccess({ providerOrderId: rzOrder, providerPaymentId: "pay_late", amountPaise: order.totalPaise });
    const o = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { events: true } });
    expect(o.status).toBe("CANCELLED");
    expect(o.events.some((e) => /refund required/.test(e.note ?? ""))).toBe(true);
  });
});

describe("expiry & retry", () => {
  it("releases stock for unpaid orders past the cutoff but not for fresh or paid ones", async () => {
    const gw = new FakeGateway();
    const stale = await pendingOrder(gw, 5);
    const fresh = await pendingOrder(gw, 5);
    await db.order.update({ where: { id: stale.order.id }, data: { createdAt: new Date(Date.now() - 3600_000) } });
    expect(await releaseExpiredOrders(30)).toBe(1);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: stale.variant.id } })).quantity).toBe(5);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: fresh.variant.id } })).quantity).toBe(4);
  });

  it("lets only the owner retry payment on a pending order", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    expect((await retryPayment(order.id, { email: "a@b.co" }, gw)).razorpayOrderId).toBe(rzOrder);
    await expect(retryPayment(order.id, { email: "someone@else.com" }, gw)).rejects.toThrow(/not found/i);
  });
});

describe("razorpay webhook endpoint", () => {
  const call = (body: object, opts: { sig?: string | null; id?: string } = {}) => {
    const raw = JSON.stringify(body);
    const signature = opts.sig === undefined ? crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(raw).digest("hex") : opts.sig;
    return webhook(new NextRequest("http://localhost/api/webhooks/razorpay", { method: "POST", body: raw, headers: { ...(signature ? { "x-razorpay-signature": signature } : {}), "x-razorpay-event-id": opts.id ?? `evt_${uid()}` } }));
  };
  const captured = (orderId: string, amount: number, id = "pay_w") => ({ event: "payment.captured", payload: { payment: { entity: { id, order_id: orderId, amount, status: "captured" } } } });

  it("rejects bad or missing signatures", async () => {
    expect((await call({ event: "x" }, { sig: "bad" })).status).toBe(400);
    expect((await call({ event: "x" }, { sig: null })).status).toBe(400);
  });

  it("confirms a captured payment and ignores a replayed event id", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    const evt = captured(rzOrder, order.totalPaise);
    expect((await call(evt, { id: "evt_1" })).status).toBe(200);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PLACED");
    const replay = await (await call(evt, { id: "evt_1" })).json();
    expect(replay.duplicate).toBe(true);
  });

  it("refuses to mark paid when the amount does not match", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    const res = await call(captured(rzOrder, 100));
    expect(res.status).toBe(409);
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING_PAYMENT");
  });

  it("records payment.failed without cancelling the order, and never downgrades a paid payment", async () => {
    const gw = new FakeGateway();
    const { order, rzOrder } = await pendingOrder(gw);
    await call({ event: "payment.failed", payload: { payment: { entity: { id: "pay_bad", order_id: rzOrder, amount: order.totalPaise, status: "failed", error_description: "Card declined" } } } });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("FAILED");
    await call(captured(rzOrder, order.totalPaise, "pay_ok"));
    await call({ event: "payment.failed", payload: { payment: { entity: { id: "pay_bad2", order_id: rzOrder, amount: order.totalPaise, status: "failed" } } } });
    expect((await db.payment.findFirstOrThrow({ where: { orderId: order.id } })).status).toBe("PAID");
  });
});
