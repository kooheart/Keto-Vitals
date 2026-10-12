import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addItem, getOrCreateCart } from "@/lib/cart";
import { placeOrder, type PlaceOrderInput } from "@/lib/orders";
import { resolveCoupon } from "@/lib/coupons";
import { FakeGateway, address, makeProduct, makeUser, resetDb, uid } from "./helpers";

beforeEach(resetDb);

async function cartWith(items: { variantId: string; qty: number }[], owner: { userId: string } | { guestToken: string } = { guestToken: `g-${uid()}` }) {
  const cart = await getOrCreateCart(owner);
  for (const i of items) await addItem(cart.id, i.variantId, i.qty);
  return cart;
}
const input = (cartId: string, o: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  cartId, idempotencyKey: `key-${uid()}-${"x".repeat(12)}`, email: "Buyer@Example.com", phone: "9876543210", address: address(), paymentMethod: "COD", ...o,
});

describe("checkout (COD)", () => {
  it("creates an order with server-computed totals, snapshots prices and decrements stock", async () => {
    const { variant } = await makeProduct({ price: 200, mrp: 300, stock: 10, name: "Snapshot Tea" });
    const cart = await cartWith([{ variantId: variant.id, qty: 2 }]);
    const { order } = await placeOrder(input(cart.id));
    // 400 subtotal (< ₹499 free-shipping threshold) + 50 zone shipping + 40 COD fee
    expect(order).toMatchObject({ subtotalPaise: 40000, shippingPaise: 5000, codFeePaise: 4000, totalPaise: 49000, status: "PLACED", paymentStatus: "COD_PENDING", email: "buyer@example.com" });
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(8);
    expect((await db.cartItem.count({ where: { cartId: cart.id } }))).toBe(0);

    // historical snapshot survives later price changes
    await db.productVariant.update({ where: { id: variant.id }, data: { pricePaise: 99900 } });
    await db.product.update({ where: { id: variant.productId }, data: { name: "Renamed" } });
    const item = await db.orderItem.findFirstOrThrow({ where: { orderId: order.id } });
    expect(item).toMatchObject({ name: "Snapshot Tea", unitPricePaise: 20000, mrpPaise: 30000, quantity: 2 });
  });

  it("is idempotent: submitting the same key twice (even concurrently) yields one order and one stock deduction", async () => {
    const { variant } = await makeProduct({ price: 100, stock: 10 });
    const cart = await cartWith([{ variantId: variant.id, qty: 1 }]);
    const i = input(cart.id);
    const results = await Promise.allSettled([placeOrder(i), placeOrder(i), placeOrder(i)]);
    const orders = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<Awaited<ReturnType<typeof placeOrder>>>).value.order.id);
    expect(new Set(orders).size).toBe(1);
    expect(await db.order.count()).toBe(1);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(9);
  });

  it("never oversells: concurrent orders for the last unit — exactly one wins", async () => {
    const { variant } = await makeProduct({ price: 100, stock: 1 });
    const carts = await Promise.all([1, 2, 3].map(() => cartWith([{ variantId: variant.id, qty: 1 }])));
    const results = await Promise.allSettled(carts.map((c) => placeOrder(input(c.id))));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(0);
  });

  it("rejects when stock fell below the cart quantity after adding", async () => {
    const { variant } = await makeProduct({ stock: 5 });
    const cart = await cartWith([{ variantId: variant.id, qty: 4 }]);
    await db.inventory.update({ where: { variantId: variant.id }, data: { quantity: 1 } });
    await expect(placeOrder(input(cart.id))).rejects.toMatchObject({ code: "stock_changed" });
    expect(await db.order.count()).toBe(0);
  });

  it("rolls back stock reservations if a later line fails (atomic)", async () => {
    const { variant: a } = await makeProduct({ stock: 5 });
    const { variant: b } = await makeProduct({ stock: 5 });
    const cart = await cartWith([{ variantId: a.id, qty: 2 }, { variantId: b.id, qty: 2 }]);
    // Simulate a race: b is drained after validation but the order loop reaches it
    await db.inventory.update({ where: { variantId: b.id }, data: { quantity: 1 } });
    await expect(placeOrder(input(cart.id))).rejects.toThrow();
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: a.id } })).quantity).toBe(5);
  });

  it("rejects empty carts, bad PIN codes and unserviceable areas", async () => {
    const empty = await getOrCreateCart({ guestToken: "empty" });
    await expect(placeOrder(input(empty.id))).rejects.toMatchObject({ code: "empty_cart" });
    const { variant } = await makeProduct();
    const cart = await cartWith([{ variantId: variant.id, qty: 1 }]);
    await expect(placeOrder(input(cart.id, { address: address({ pincode: "999999" }) }))).rejects.toMatchObject({ code: "not_serviceable" });
  });

  it("blocks COD where the zone does not allow it, and above the COD limit", async () => {
    const { variant } = await makeProduct({ price: 100 });
    const c1 = await cartWith([{ variantId: variant.id, qty: 1 }]);
    await expect(placeOrder(input(c1.id, { address: address({ pincode: "190001" }) }))).rejects.toMatchObject({ code: "cod_unavailable" });
    const { variant: pricey } = await makeProduct({ price: 6000, stock: 5 });
    const c2 = await cartWith([{ variantId: pricey.id, qty: 1 }]);
    await expect(placeOrder(input(c2.id))).rejects.toMatchObject({ code: "cod_limit" });
  });

  it("applies coupons server-side, counts redemptions, and enforces per-user limits", async () => {
    const user = await makeUser();
    await db.coupon.create({ data: { code: "SAVE10", type: "PERCENT", value: 10, maxDiscountPaise: 5000, perUserLimit: 1, minSubtotalPaise: 10000 } });
    const { variant } = await makeProduct({ price: 300, stock: 20 });
    const cart = await cartWith([{ variantId: variant.id, qty: 2 }], { userId: user.id });
    await db.cart.update({ where: { id: cart.id }, data: { couponCode: "save10" } });
    const { order } = await placeOrder(input(cart.id, { userId: user.id, couponCode: "save10" }));
    expect(order.discountPaise).toBe(5000); // 10% of 600 = 60, capped at 50
    expect(order.couponCode).toBe("SAVE10");
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "SAVE10" } })).usedCount).toBe(1);
    const again = await resolveCoupon("SAVE10", { subtotalPaise: 60000, userId: user.id });
    expect(again).toMatchObject({ ok: false });
  });

  it("does not let a fully redeemed coupon through at order time", async () => {
    await db.coupon.create({ data: { code: "ONCE", type: "FIXED", value: 1000, usageLimit: 1 } });
    const { variant } = await makeProduct({ price: 300, stock: 20 });
    const [c1, c2] = await Promise.all([cartWith([{ variantId: variant.id, qty: 1 }]), cartWith([{ variantId: variant.id, qty: 1 }])]);
    const r = await Promise.allSettled([placeOrder(input(c1.id, { couponCode: "ONCE" })), placeOrder(input(c2.id, { couponCode: "ONCE" }))]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect((await db.coupon.findUniqueOrThrow({ where: { code: "ONCE" } })).usedCount).toBe(1);
  });
});

describe("checkout (online)", () => {
  it("holds stock and creates a provider order; order stays PENDING_PAYMENT until verified", async () => {
    const gw = new FakeGateway();
    const { variant } = await makeProduct({ price: 300, stock: 4 });
    const cart = await cartWith([{ variantId: variant.id, qty: 1 }]);
    const r = await placeOrder(input(cart.id, { paymentMethod: "RAZORPAY" }), gw);
    expect(r.order).toMatchObject({ status: "PENDING_PAYMENT", paymentStatus: "CREATED", totalPaise: 35000 });
    expect(r.razorpay?.amountPaise).toBe(35000);
    expect(gw.orders.get(r.razorpay!.razorpayOrderId)?.amountPaise).toBe(35000);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(3);
  });

  it("releases the held stock if the provider order cannot be created", async () => {
    const gw = new FakeGateway();
    gw.createOrder = async () => { throw new Error("gateway down"); };
    const { variant } = await makeProduct({ stock: 4 });
    const cart = await cartWith([{ variantId: variant.id, qty: 2 }]);
    await expect(placeOrder(input(cart.id, { paymentMethod: "RAZORPAY" }), gw)).rejects.toThrow();
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(4);
    expect((await db.order.findFirstOrThrow()).status).toBe("CANCELLED");
  });
});
