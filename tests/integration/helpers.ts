import { db } from "@/lib/db";
import { ROLE_DEFAULTS } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { syncProductDerived } from "@/lib/catalog";
import type { PaymentGateway, GatewayPayment } from "@/lib/razorpay";

const TABLES = ["WebhookEvent", "CouponRedemption", "Coupon", "OrderEvent", "Payment", "OrderItem", "Order", "CartItem", "Cart", "WishlistItem", "Wishlist", "Review", "Inventory", "ProductVariant", "ProductImage", "CollectionProduct", "Collection", "Product", "Category", "Address", "AuthToken", "Session", "User", "Role", "ShippingZone", "SiteSetting", "Banner", "Subscriber"];

export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  for (const [name, r] of Object.entries(ROLE_DEFAULTS)) await db.role.create({ data: { name, ...r } });
  await db.shippingZone.create({ data: { name: "India", pinPrefixes: ["1", "4", "5"], ratePaise: 5000, etaMinDays: 3, etaMaxDays: 6, codAvailable: true } });
  await db.shippingZone.create({ data: { name: "Restricted", pinPrefixes: ["19"], ratePaise: 9900, codAvailable: false } });
}

let n = 0;
export const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeUser(role: "customer" | "manager" | "admin" = "customer", email = `u${uid()}@example.com`) {
  const r = await db.role.findUniqueOrThrow({ where: { name: role } });
  return db.user.create({ data: { email, name: "Test User", passwordHash: await hashPassword("Passw0rd!x1"), roleId: r.id } });
}

export async function makeCategory(slug = `cat-${uid()}`, parentId?: string) {
  return db.category.create({ data: { slug, name: slug.toUpperCase(), parentId } });
}

export type ProductOpts = { name?: string; price?: number; mrp?: number; stock?: number; categoryId?: string; gst?: number; tags?: string[]; form?: string; description?: string; sold?: number; status?: "ACTIVE" | "DRAFT" };

/** Creates an ACTIVE product with one variant (prices in rupees) and inventory. */
export async function makeProduct(o: ProductOpts = {}) {
  const id = uid();
  const categoryId = o.categoryId ?? (await makeCategory()).id;
  const p = await db.product.create({
    data: {
      slug: `p-${id}`, name: o.name ?? `Product ${id}`, description: o.description ?? "A test product", categoryId, gstRate: o.gst ?? 18,
      tags: o.tags ?? [], form: o.form, status: o.status ?? "ACTIVE", soldCount: o.sold ?? 0,
      variants: { create: { sku: `SKU-${id}`, name: "Default", mrpPaise: (o.mrp ?? o.price ?? 500) * 100, pricePaise: (o.price ?? 500) * 100, isDefault: true, inventory: { create: { quantity: o.stock ?? 10 } } } },
    },
    include: { variants: true },
  });
  await syncProductDerived(p.id);
  return { product: p, variant: p.variants[0] };
}

export const address = (over: Record<string, unknown> = {}) => ({ fullName: "Asha Rao", phone: "9876543210", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", ...over });

/** Deterministic in-memory Razorpay stand-in (no network). */
export class FakeGateway implements PaymentGateway {
  orders = new Map<string, { amountPaise: number; receipt: string }>();
  payments = new Map<string, GatewayPayment>();
  private seq = 0;
  async createOrder(p: { amountPaise: number; receipt: string }) {
    const id = `order_fake${++this.seq}`;
    this.orders.set(id, p);
    return { id };
  }
  async fetchPayment(id: string) {
    const p = this.payments.get(id);
    if (!p) throw new Error("unknown payment");
    return p;
  }
  addPayment(id: string, orderId: string, status: GatewayPayment["status"], amount?: number) {
    this.payments.set(id, { id, order_id: orderId, status, amount: amount ?? this.orders.get(orderId)!.amountPaise, currency: "INR" });
  }
}
