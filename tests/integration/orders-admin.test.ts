import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { addItem, getOrCreateCart } from "@/lib/cart";
import { cancelOrder, placeOrder, updateOrderStatus } from "@/lib/orders";
import { sha256 } from "@/lib/auth/password";
import { address, makeProduct, makeUser, resetDb, uid } from "./helpers";

// requirePermission reads the session cookie via next/headers; supply it from a mutable variable.
let cookieToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "kv_session" && cookieToken ? { value: cookieToken } : undefined), set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn })); // no request scope in tests
import { requirePermission, requireUser } from "@/lib/auth/session";

beforeEach(async () => {
  await resetDb();
  cookieToken = undefined;
});

async function signIn(role: "customer" | "manager" | "admin") {
  const u = await makeUser(role);
  cookieToken = `tok-${uid()}`;
  await db.session.create({ data: { tokenHash: sha256(cookieToken), userId: u.id, expiresAt: new Date(Date.now() + 1e6) } });
  return u;
}

async function codOrder(qty = 2, stock = 10) {
  const { variant, product } = await makeProduct({ price: 200, stock });
  const cart = await getOrCreateCart({ guestToken: `g-${uid()}` });
  await addItem(cart.id, variant.id, qty);
  const { order } = await placeOrder({ cartId: cart.id, idempotencyKey: `k-${uid()}-${"z".repeat(12)}`, email: "c@x.co", phone: "9876543210", address: address(), paymentMethod: "COD" });
  return { order, variant, product };
}

describe("admin authorization", () => {
  it("anonymous users are rejected (401)", async () => {
    await expect(requirePermission("orders.manage")).rejects.toMatchObject({ status: 401 });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
  it("customers are forbidden (403) from every admin permission", async () => {
    await signIn("customer");
    for (const p of ["dashboard.view", "products.write", "orders.manage", "settings.write", "coupons.write"] as const)
      await expect(requirePermission(p)).rejects.toMatchObject({ status: 403 });
  });
  it("managers get catalogue/order permissions but not settings or coupons", async () => {
    await signIn("manager");
    await expect(requirePermission("orders.manage")).resolves.toBeTruthy();
    await expect(requirePermission("products.write")).resolves.toBeTruthy();
    await expect(requirePermission("settings.write")).rejects.toMatchObject({ status: 403 });
    await expect(requirePermission("coupons.write")).rejects.toMatchObject({ status: 403 });
  });
  it("admins have everything; disabled or expired sessions are refused", async () => {
    const admin = await signIn("admin");
    await expect(requirePermission("settings.write")).resolves.toMatchObject({ role: "admin" });
    await db.user.update({ where: { id: admin.id }, data: { disabledAt: new Date() } });
    await expect(requirePermission("settings.write")).rejects.toMatchObject({ status: 401 });
    await db.user.update({ where: { id: admin.id }, data: { disabledAt: null } });
    await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("order status changes", () => {
  it("walks the happy path, requires tracking to ship, and COD becomes PAID on delivery", async () => {
    const actor = await makeUser("admin");
    const { order } = await codOrder();
    await expect(updateOrderStatus(order.id, "SHIPPED", { actorId: actor.id })).rejects.toMatchObject({ code: "bad_transition" });
    await updateOrderStatus(order.id, "PROCESSING", { actorId: actor.id });
    await expect(updateOrderStatus(order.id, "SHIPPED", { actorId: actor.id })).rejects.toMatchObject({ code: "tracking_required" });
    await updateOrderStatus(order.id, "SHIPPED", { actorId: actor.id, carrier: "Delhivery", trackingNumber: "DL123" });
    const done = await updateOrderStatus(order.id, "DELIVERED", { actorId: actor.id });
    expect(done).toMatchObject({ status: "DELIVERED", paymentStatus: "PAID", trackingNumber: "DL123" });
    const events = await db.orderEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => e.status)).toEqual(["PLACED", "PROCESSING", "SHIPPED", "DELIVERED"]);
  });

  it("cancelling restocks inventory, reverses sales count and coupon use; cannot cancel twice or after shipping", async () => {
    const actor = await makeUser("admin");
    const { order, variant, product } = await codOrder(3, 10);
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(7);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(3);
    await updateOrderStatus(order.id, "CANCELLED", { actorId: actor.id, note: "Customer asked" });
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(10);
    expect((await db.product.findUniqueOrThrow({ where: { id: product.id } })).soldCount).toBe(0);
    await expect(cancelOrder(order.id, { reason: "again", actorId: null })).rejects.toMatchObject({ code: "bad_transition" });
    expect((await db.inventory.findUniqueOrThrow({ where: { variantId: variant.id } })).quantity).toBe(10); // not double-restocked

    const { order: o2 } = await codOrder();
    await updateOrderStatus(o2.id, "PROCESSING", { actorId: actor.id });
    await updateOrderStatus(o2.id, "SHIPPED", { actorId: actor.id, trackingNumber: "T1" });
    await expect(updateOrderStatus(o2.id, "CANCELLED", { actorId: actor.id })).rejects.toMatchObject({ code: "bad_transition" });
  });
});

describe("reviews", () => {
  it("verified-purchase flag is derived from delivered orders, not from the client", async () => {
    const { POST } = await import("@/app/api/reviews/route");
    const { NextRequest } = await import("next/server");
    const user = await signIn("customer");
    const { variant, product } = await makeProduct();
    const post = (body: object) => POST(new NextRequest("http://localhost/api/reviews", { method: "POST", body: JSON.stringify(body), headers: { host: "localhost" } }), { params: Promise.resolve({}) });

    expect((await post({ productId: product.id, rating: 5, body: "Really good product", verifiedPurchase: true })).status).toBe(200);
    let r = await db.review.findFirstOrThrow({ where: { userId: user.id } });
    expect(r).toMatchObject({ verifiedPurchase: false, status: "PENDING" });

    const o = await db.order.create({ data: { number: `N-${uid()}`, userId: user.id, email: user.email, phone: "9876543210", status: "DELIVERED", paymentMethod: "COD", paymentStatus: "PAID", idempotencyKey: `idem-${uid()}-xxxxxxxx`, shippingAddress: {}, subtotalPaise: 1, totalPaise: 1, items: { create: { productId: product.id, variantId: variant.id, name: "n", variantName: "v", sku: "s", unitPricePaise: 1, mrpPaise: 1, quantity: 1, lineTotalPaise: 1, gstRate: 5 } } } });
    expect(o.id).toBeTruthy();
    await post({ productId: product.id, rating: 4, body: "Updated after delivery" });
    r = await db.review.findFirstOrThrow({ where: { userId: user.id } });
    expect(r).toMatchObject({ verifiedPurchase: true, rating: 4 });
    expect(await db.review.count()).toBe(1); // one review per customer per product
  });

  it("requires sign-in and valid input", async () => {
    const { POST } = await import("@/app/api/reviews/route");
    const { NextRequest } = await import("next/server");
    const { product } = await makeProduct();
    const post = (body: object) => POST(new NextRequest("http://localhost/api/reviews", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({}) });
    expect((await post({ productId: product.id, rating: 5, body: "Nice product here" })).status).toBe(401);
    await signIn("customer");
    expect((await post({ productId: product.id, rating: 9, body: "Nice product here" })).status).toBe(400);
    expect((await post({ productId: product.id, rating: 5, body: "short" })).status).toBe(400);
  });
});
