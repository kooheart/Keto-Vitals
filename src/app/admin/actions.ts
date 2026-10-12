"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { storeImage } from "@/lib/storage";
import { syncProductDerived } from "@/lib/catalog";
import { updateOrderStatus } from "@/lib/orders";
import { setSetting, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { normalizeCoupon } from "@/lib/coupons";
import { guarded, str, optStr, int, paise, bool, lines, kv, type ActionState } from "@/lib/admin/run";
import type { OrderStatus } from "@prisma/client";

const done = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

// ───────── Products ─────────
function productData(fd: FormData) {
  const name = str(fd, "name");
  if (name.length < 2) throw badRequest("Product name is required.");
  return {
    name, brand: str(fd, "brand") || "Keto Vitals", categoryId: str(fd, "categoryId"), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).parse(str(fd, "status")),
    form: optStr(fd, "form"), tags: str(fd, "tags").split(",").map((t) => slugify(t)).filter(Boolean), gstRate: z.number().int().min(0).max(40).parse(int(fd, "gstRate", 18)), hsnCode: optStr(fd, "hsnCode"),
    shortDescription: optStr(fd, "shortDescription"), description: str(fd, "description") || name, features: lines(fd, "features"), specs: kv(fd, "specs"),
    seoTitle: optStr(fd, "seoTitle"), seoDescription: optStr(fd, "seoDescription"),
  };
}

export async function createProduct(_: ActionState, fd: FormData) {
  let id = "";
  const r = await guarded("products.write", async () => {
    const d = productData(fd);
    if (!(await db.category.findUnique({ where: { id: d.categoryId } }))) throw badRequest("Choose a category.");
    let slug = slugify(str(fd, "slug") || d.name);
    if (await db.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    id = (await db.product.create({ data: { ...d, slug, specs: d.specs } })).id;
  });
  if (r?.ok) redirect(`/admin/products/${id}?created=1`);
  return r;
}

export async function updateProduct(id: string, _: ActionState, fd: FormData) {
  return guarded("products.write", async () => {
    const d = productData(fd);
    const slug = slugify(str(fd, "slug"));
    if (!slug) throw badRequest("Slug is required.");
    await db.product.update({ where: { id }, data: { ...d, slug } });
    await syncProductDerived(id);
    done("/admin/products", "/", `/product/${slug}`);
    return "Product saved";
  });
}

export async function deleteProduct(id: string, _: ActionState, __: FormData) {
  const r = await guarded("products.write", async () => {
    // Orders keep their own snapshots, but we never hard-delete a product that has been sold: archive instead.
    if (await db.orderItem.findFirst({ where: { productId: id }, select: { id: true } })) {
      await db.product.update({ where: { id }, data: { status: "ARCHIVED" } });
      done("/admin/products", "/");
      return "This product has order history, so it was archived instead of deleted.";
    }
    await db.product.delete({ where: { id } });
    done("/admin/products", "/");
  });
  if (r?.ok && !r.ok.startsWith("This product")) redirect("/admin/products");
  return r;
}

export async function uploadProductImage(id: string, _: ActionState, fd: FormData) {
  return guarded("products.write", async () => {
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) throw badRequest("Choose an image to upload.");
    const url = await storeImage(file);
    const count = await db.productImage.count({ where: { productId: id } });
    await db.productImage.create({ data: { productId: id, url, alt: str(fd, "alt") || (await db.product.findUniqueOrThrow({ where: { id } })).name, sortOrder: count } });
    done(`/admin/products/${id}`, "/");
    return "Image uploaded";
  });
}

export async function deleteProductImage(imageId: string, _: ActionState, __: FormData) {
  return guarded("products.write", async () => {
    const img = await db.productImage.delete({ where: { id: imageId } });
    done(`/admin/products/${img.productId}`);
  });
}

const variantSchema = z.object({ sku: z.string().min(2).max(40), name: z.string().min(1).max(80), mrpPaise: z.number().int().positive(), pricePaise: z.number().int().positive(), weightGrams: z.number().int().min(0).max(100000) });
function variantData(fd: FormData) {
  const v = variantSchema.parse({ sku: str(fd, "sku"), name: str(fd, "name"), mrpPaise: paise(fd, "mrp"), pricePaise: paise(fd, "price"), weightGrams: int(fd, "weightGrams", 250) });
  if (v.pricePaise > v.mrpPaise) throw badRequest("Selling price cannot exceed MRP.");
  const attributes = kv(fd, "attributes");
  return { ...v, attributes: Object.keys(attributes).length ? attributes : { Size: v.name } };
}

export async function addVariant(productId: string, _: ActionState, fd: FormData) {
  return guarded("products.write", async () => {
    const d = variantData(fd);
    const qty = Math.max(0, int(fd, "stock"));
    const first = (await db.productVariant.count({ where: { productId } })) === 0;
    await db.productVariant.create({ data: { ...d, productId, isDefault: first, inventory: { create: { quantity: qty } } } });
    await syncProductDerived(productId);
    done(`/admin/products/${productId}`, "/admin/inventory");
    return "Variant added";
  });
}

export async function updateVariant(variantId: string, _: ActionState, fd: FormData) {
  return guarded("products.write", async () => {
    const d = variantData(fd);
    const v = await db.productVariant.update({ where: { id: variantId }, data: { ...d, isActive: bool(fd, "isActive") } });
    await syncProductDerived(v.productId);
    done(`/admin/products/${v.productId}`, "/", `/admin/inventory`);
    return "Variant saved";
  });
}

export async function setStock(variantId: string, _: ActionState, fd: FormData) {
  return guarded("inventory.write", async () => {
    const qty = int(fd, "quantity", -1);
    if (qty < 0 || qty > 1_000_000) throw badRequest("Enter a stock quantity of 0 or more.");
    const inv = await db.inventory.upsert({ where: { variantId }, create: { variantId, quantity: qty, lowStockThreshold: int(fd, "threshold", 10) }, update: { quantity: qty, lowStockThreshold: int(fd, "threshold", 10) }, include: { variant: true } });
    await syncProductDerived(inv.variant.productId);
    done("/admin/inventory", "/");
    return "Stock updated";
  });
}

// ───────── Categories & collections ─────────
export async function saveCategory(id: string | null, _: ActionState, fd: FormData) {
  return guarded("categories.write", async () => {
    const name = str(fd, "name");
    if (name.length < 2) throw badRequest("Name is required.");
    const parentId = optStr(fd, "parentId");
    if (id && parentId === id) throw badRequest("A category cannot be its own parent.");
    const data = { name, slug: slugify(str(fd, "slug") || name), description: optStr(fd, "description"), parentId, sortOrder: int(fd, "sortOrder"), isActive: bool(fd, "isActive") };
    const file = fd.get("image");
    const imageUrl = file instanceof File && file.size > 0 ? await storeImage(file) : undefined;
    if (id) await db.category.update({ where: { id }, data: { ...data, ...(imageUrl ? { imageUrl } : {}) } });
    else await db.category.create({ data: { ...data, imageUrl } });
    done("/admin/categories", "/");
    return "Category saved";
  });
}

export async function deleteCategory(id: string, _: ActionState, __: FormData) {
  return guarded("categories.write", async () => {
    if (await db.product.count({ where: { categoryId: id } })) throw conflict("Move or delete this category's products first.");
    if (await db.category.count({ where: { parentId: id } })) throw conflict("Delete or move its subcategories first.");
    await db.category.delete({ where: { id } });
    done("/admin/categories", "/");
  });
}

export async function saveCollection(id: string | null, _: ActionState, fd: FormData) {
  return guarded("categories.write", async () => {
    const name = str(fd, "name");
    if (name.length < 2) throw badRequest("Name is required.");
    const data = { name, slug: slugify(str(fd, "slug") || name), description: optStr(fd, "description"), isFeatured: bool(fd, "isFeatured"), isActive: bool(fd, "isActive"), sortOrder: int(fd, "sortOrder") };
    const file = fd.get("image");
    const imageUrl = file instanceof File && file.size > 0 ? await storeImage(file) : undefined;
    const c = id ? await db.collection.update({ where: { id }, data: { ...data, ...(imageUrl ? { imageUrl } : {}) } }) : await db.collection.create({ data: { ...data, imageUrl } });
    // product membership: comma/line separated slugs
    const slugs = str(fd, "products").split(/[\s,]+/).filter(Boolean);
    const prods = await db.product.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } });
    const unknown = slugs.filter((s) => !prods.some((p) => p.slug === s));
    if (unknown.length) throw badRequest(`Unknown product slug(s): ${unknown.join(", ")}`);
    await db.$transaction([db.collectionProduct.deleteMany({ where: { collectionId: c.id } }), db.collectionProduct.createMany({ data: slugs.map((s, i) => ({ collectionId: c.id, productId: prods.find((p) => p.slug === s)!.id, position: i })) })]);
    done("/admin/collections", "/");
    return "Collection saved";
  });
}

export async function deleteCollection(id: string, _: ActionState, __: FormData) {
  return guarded("categories.write", async () => { await db.collection.delete({ where: { id } }); done("/admin/collections", "/"); });
}

// ───────── Orders ─────────
export async function changeOrderStatus(orderId: string, _: ActionState, fd: FormData) {
  return guarded("orders.manage", async (actor) => {
    const to = z.enum(["PLACED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"]).parse(str(fd, "status")) as OrderStatus;
    await updateOrderStatus(orderId, to, { actorId: actor.id, note: optStr(fd, "note") ?? undefined, carrier: optStr(fd, "carrier") ?? undefined, trackingNumber: optStr(fd, "trackingNumber") ?? undefined });
    done("/admin/orders", `/admin/orders/${orderId}`, "/admin");
    return `Order marked ${to.toLowerCase()}`;
  });
}

// ───────── Coupons ─────────
export async function saveCoupon(id: string | null, _: ActionState, fd: FormData) {
  return guarded("coupons.write", async () => {
    const type = z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]).parse(str(fd, "type"));
    const code = normalizeCoupon(str(fd, "code"));
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) throw badRequest("Code must be 3–30 characters: letters, numbers, - or _.");
    const value = type === "PERCENT" ? int(fd, "value") : type === "FIXED" ? paise(fd, "value") : 0;
    if (type === "PERCENT" && (value < 1 || value > 100)) throw badRequest("Percent must be between 1 and 100.");
    if (type === "FIXED" && value < 1) throw badRequest("Enter a discount amount.");
    const date = (k: string) => (str(fd, k) ? new Date(str(fd, k)) : null);
    const maxD = str(fd, "maxDiscount") ? paise(fd, "maxDiscount") : null;
    const data = { code, description: optStr(fd, "description"), type, value, minSubtotalPaise: paise(fd, "minSubtotal"), maxDiscountPaise: maxD, startsAt: date("startsAt"), endsAt: date("endsAt"), usageLimit: str(fd, "usageLimit") ? int(fd, "usageLimit") : null, perUserLimit: str(fd, "perUserLimit") ? int(fd, "perUserLimit") : null, isActive: bool(fd, "isActive") };
    if (id) await db.coupon.update({ where: { id }, data }); else await db.coupon.create({ data });
    done("/admin/coupons");
    return "Coupon saved";
  });
}
export async function deleteCoupon(id: string, _: ActionState, __: FormData) {
  return guarded("coupons.write", async () => {
    if (await db.couponRedemption.count({ where: { couponId: id } })) { await db.coupon.update({ where: { id }, data: { isActive: false } }); done("/admin/coupons"); return "Coupon has been used, so it was deactivated rather than deleted."; }
    await db.coupon.delete({ where: { id } }); done("/admin/coupons");
  });
}

// ───────── Reviews ─────────
export async function moderateReview(id: string, status: "APPROVED" | "REJECTED", _: ActionState, __: FormData) {
  return guarded("reviews.moderate", async () => {
    const r = await db.review.update({ where: { id }, data: { status } });
    await syncProductDerived(r.productId);
    done("/admin/reviews", "/");
    return status === "APPROVED" ? "Approved" : "Rejected";
  });
}

// ───────── Banners ─────────
export async function saveBanner(id: string | null, _: ActionState, fd: FormData) {
  return guarded("marketing.write", async () => {
    const title = str(fd, "title");
    if (!title) throw badRequest("Title is required.");
    const link = optStr(fd, "linkUrl");
    if (link && !(link.startsWith("/") && !link.startsWith("//")) && !/^https:\/\//.test(link)) throw badRequest("Link must start with / or https://");
    const file = fd.get("image");
    const imageUrl = file instanceof File && file.size > 0 ? await storeImage(file) : undefined;
    const data = { placement: z.enum(["HERO", "MID", "PROMO_STRIP"]).parse(str(fd, "placement")), eyebrow: optStr(fd, "eyebrow"), title, subtitle: optStr(fd, "subtitle"), ctaLabel: optStr(fd, "ctaLabel"), linkUrl: link, theme: z.enum(["dark", "light", "gold"]).parse(str(fd, "theme") || "dark"), sortOrder: int(fd, "sortOrder"), isActive: bool(fd, "isActive") };
    if (id) await db.banner.update({ where: { id }, data: { ...data, ...(imageUrl ? { imageUrl } : {}) } }); else await db.banner.create({ data: { ...data, imageUrl } });
    done("/admin/banners", "/");
    return "Banner saved";
  });
}
export async function deleteBanner(id: string, _: ActionState, __: FormData) {
  return guarded("marketing.write", async () => { await db.banner.delete({ where: { id } }); done("/admin/banners", "/"); });
}

// ───────── Settings, shipping zones, customers ─────────
export async function saveSettings(_: ActionState, fd: FormData) {
  return guarded("settings.write", async () => {
    const keys = Object.keys(SETTING_DEFAULTS) as SettingKey[];
    for (const k of keys) {
      if (!fd.has(`s:${k}`) && typeof SETTING_DEFAULTS[k] !== "boolean") continue;
      const def = SETTING_DEFAULTS[k];
      if (typeof def === "boolean") await setSetting(k, fd.get(`s:${k}`) === "on");
      else if (typeof def === "number") {
        const raw = Number(fd.get(`s:${k}`));
        if (!Number.isFinite(raw) || raw < 0) throw badRequest(`Invalid value for ${k}`);
        await setSetting(k, k.endsWith("Paise") ? Math.round(raw * 100) : Math.round(raw)); // money fields are entered in rupees
      } else await setSetting(k, str(fd, `s:${k}`).slice(0, 300));
    }
    done("/", "/admin/settings");
    return "Settings saved";
  });
}

export async function saveZone(id: string | null, _: ActionState, fd: FormData) {
  return guarded("settings.write", async () => {
    const prefixes = str(fd, "pinPrefixes").split(/[\s,]+/).filter(Boolean);
    if (!prefixes.length || prefixes.some((p) => !/^[1-9]\d{0,5}$/.test(p))) throw badRequest("PIN prefixes must be 1–6 digit numbers not starting with 0.");
    const data = { name: str(fd, "name") || "Zone", pinPrefixes: prefixes, ratePaise: paise(fd, "rate"), etaMinDays: int(fd, "etaMinDays", 3), etaMaxDays: int(fd, "etaMaxDays", 7), codAvailable: bool(fd, "codAvailable"), isActive: bool(fd, "isActive") };
    if (data.etaMinDays > data.etaMaxDays) throw badRequest("Minimum days cannot exceed maximum days.");
    if (id) await db.shippingZone.update({ where: { id }, data }); else await db.shippingZone.create({ data });
    done("/admin/settings");
    return "Zone saved";
  });
}
export async function deleteZone(id: string, _: ActionState, __: FormData) {
  return guarded("settings.write", async () => { await db.shippingZone.delete({ where: { id } }); done("/admin/settings"); });
}

export async function toggleCustomer(id: string, _: ActionState, __: FormData) {
  // Account disabling is an admin-level action (settings.write is held only by the admin role by default).
  return guarded("settings.write", async (actor) => {
    const u = await db.user.findUnique({ where: { id }, include: { role: true } });
    if (!u) throw notFound();
    if (u.id === actor.id || u.role.name !== "customer") throw badRequest("You can only disable customer accounts.");
    await db.user.update({ where: { id }, data: { disabledAt: u.disabledAt ? null : new Date() } });
    if (!u.disabledAt) await db.session.deleteMany({ where: { userId: id } });
    done("/admin/customers");
    return u.disabledAt ? "Account re-enabled" : "Account disabled";
  });
}
