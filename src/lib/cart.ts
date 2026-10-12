import { db } from "./db";
import { badRequest } from "./errors";
import { resolveCoupon } from "./coupons";
import { computeTotals, type PricingResult } from "./pricing";
import { getSettings } from "./settings";
import { sha256 } from "./auth/password";

export const MAX_QTY_PER_LINE = 10;

export type CartOwner = { userId: string } | { guestToken: string };

export async function findCart(owner: CartOwner) {
  return "userId" in owner
    ? db.cart.findUnique({ where: { userId: owner.userId } })
    : db.cart.findUnique({ where: { guestHash: sha256(owner.guestToken) } });
}

export async function getOrCreateCart(owner: CartOwner) {
  const existing = await findCart(owner);
  if (existing) return existing;
  return db.cart.create({ data: "userId" in owner ? { userId: owner.userId } : { guestHash: sha256(owner.guestToken) } });
}

const variantInclude = {
  inventory: { select: { quantity: true } },
  product: { select: { id: true, slug: true, name: true, status: true, gstRate: true, images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { url: true, alt: true } } } },
};

/** Validates variant + stock server-side; quantity is clamped to what we can actually sell. */
export async function addItem(cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) throw badRequest("Quantity must be at least 1");
  const v = await db.productVariant.findUnique({ where: { id: variantId }, include: variantInclude });
  if (!v || !v.isActive || v.product.status !== "ACTIVE") throw badRequest("This product is no longer available.", "unavailable");
  const stock = v.inventory?.quantity ?? 0;
  if (stock < 1) throw badRequest("Sorry, this item is out of stock.", "out_of_stock");
  const existing = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } } });
  const wanted = (existing?.quantity ?? 0) + quantity;
  const qty = Math.min(wanted, MAX_QTY_PER_LINE, stock);
  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity: qty },
    update: { quantity: qty },
  });
  await db.cart.update({ where: { id: cartId }, data: { updatedAt: new Date() } });
  return { quantity: qty, clamped: qty < wanted, stock };
}

export async function setQuantity(cartId: string, variantId: string, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 0) throw badRequest("Invalid quantity");
  if (quantity === 0) {
    await db.cartItem.deleteMany({ where: { cartId, variantId } });
    return { quantity: 0, clamped: false, stock: 0 };
  }
  const item = await db.cartItem.findUnique({ where: { cartId_variantId: { cartId, variantId } }, include: { variant: { include: { inventory: true } } } });
  if (!item) throw badRequest("Item is not in your cart", "not_in_cart");
  const stock = item.variant.inventory?.quantity ?? 0;
  const qty = Math.min(quantity, MAX_QTY_PER_LINE, stock);
  if (qty < 1) throw badRequest("Sorry, this item is out of stock.", "out_of_stock");
  await db.cartItem.update({ where: { id: item.id }, data: { quantity: qty } });
  return { quantity: qty, clamped: qty < quantity, stock };
}

export async function removeItem(cartId: string, variantId: string) {
  await db.cartItem.deleteMany({ where: { cartId, variantId } });
}

/** After login: fold the guest cart into the user's cart, then delete the guest cart. */
export async function mergeGuestCart(userId: string, guestToken: string) {
  const guest = await db.cart.findUnique({ where: { guestHash: sha256(guestToken) }, include: { items: true } });
  if (!guest) return;
  const mine = await getOrCreateCart({ userId });
  for (const it of guest.items) {
    try {
      await addItem(mine.id, it.variantId, it.quantity);
    } catch {
      /* item no longer purchasable — drop it */
    }
  }
  if (guest.couponCode && !mine.couponCode) await db.cart.update({ where: { id: mine.id }, data: { couponCode: guest.couponCode } });
  await db.cart.delete({ where: { id: guest.id } });
}

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  sku: string;
  imageUrl: string | null;
  imageAlt: string;
  unitPricePaise: number;
  mrpPaise: number;
  quantity: number;
  stock: number;
  gstRate: number;
  lineTotalPaise: number;
  issue?: string;
};

export type CartView = {
  lines: CartLine[];
  pricing: PricingResult;
  coupon: { code: string; description: string | null } | null;
  couponError?: string;
  itemCount: number;
  hasIssues: boolean;
  freeShippingThresholdPaise: number;
};

export async function loadLines(cartId: string): Promise<CartLine[]> {
  const items = await db.cartItem.findMany({ where: { cartId }, orderBy: { createdAt: "asc" }, include: { variant: { include: variantInclude } } });
  return items.map((i) => {
    const v = i.variant;
    const stock = v.inventory?.quantity ?? 0;
    const available = v.isActive && v.product.status === "ACTIVE";
    const issue = !available ? "No longer available" : stock < 1 ? "Out of stock" : i.quantity > stock ? `Only ${stock} left` : undefined;
    return {
      variantId: v.id,
      productId: v.product.id,
      slug: v.product.slug,
      name: v.product.name,
      variantName: v.name,
      sku: v.sku,
      imageUrl: v.product.images[0]?.url ?? null,
      imageAlt: v.product.images[0]?.alt ?? v.product.name,
      unitPricePaise: v.pricePaise, // always the DB price — never client-supplied
      mrpPaise: v.mrpPaise,
      quantity: i.quantity,
      stock,
      gstRate: v.product.gstRate,
      lineTotalPaise: v.pricePaise * i.quantity,
      issue,
    };
  });
}

export type PriceOpts = {
  couponCode?: string | null;
  userId?: string | null;
  email?: string | null;
  shippingRatePaise?: number;
  cod?: boolean;
};

export async function priceLines(lines: CartLine[], opts: PriceOpts) {
  const s = await getSettings();
  const subtotal = lines.reduce((a, l) => a + l.lineTotalPaise, 0);
  let coupon: Awaited<ReturnType<typeof resolveCoupon>> | null = null;
  if (opts.couponCode) coupon = await resolveCoupon(opts.couponCode, { subtotalPaise: subtotal, userId: opts.userId, email: opts.email });
  const pricing = computeTotals({
    lines: lines.map((l) => ({ unitPricePaise: l.unitPricePaise, quantity: l.quantity, gstRate: l.gstRate })),
    coupon: coupon?.ok ? coupon.effect : null,
    shippingRatePaise: opts.shippingRatePaise ?? s["shipping.defaultRatePaise"],
    freeShippingThresholdPaise: s["shipping.freeThresholdPaise"],
    cod: opts.cod ? { feePaise: s["cod.feePaise"] } : null,
    shippingGstRate: s["tax.shippingGstRate"],
  });
  return { pricing, coupon, settings: s };
}

export async function getCartView(cartId: string | null, userId?: string | null): Promise<CartView> {
  const s = await getSettings();
  const cart = cartId ? await db.cart.findUnique({ where: { id: cartId } }) : null;
  const lines = cart ? await loadLines(cart.id) : [];
  const { pricing, coupon } = await priceLines(lines, { couponCode: cart?.couponCode, userId });
  return {
    lines,
    pricing,
    coupon: coupon?.ok ? { code: coupon.coupon.code, description: coupon.coupon.description } : null,
    couponError: coupon && !coupon.ok ? coupon.reason : undefined,
    itemCount: lines.reduce((a, l) => a + l.quantity, 0),
    hasIssues: lines.some((l) => l.issue),
    freeShippingThresholdPaise: s["shipping.freeThresholdPaise"],
  };
}
