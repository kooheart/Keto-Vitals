/**
 * Idempotent seed: safe to run repeatedly. Creates roles, an admin account, catalogue,
 * coupons, shipping zones and homepage banners. No reviews or orders are fabricated.
 */
import { config } from "dotenv";
config();
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { categories, collections, products } from "./catalog-data";
import { ROLE_DEFAULTS } from "../src/lib/auth/permissions";
import { syncProductDerived } from "../src/lib/catalog";

const db = new PrismaClient();

async function main() {
  for (const [name, r] of Object.entries(ROLE_DEFAULTS))
    await db.role.upsert({ where: { name }, create: { name, ...r }, update: { permissions: r.permissions, description: r.description } });

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "").toLowerCase();
  const adminPw = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPw) {
    const role = await db.role.findUniqueOrThrow({ where: { name: "admin" } });
    const existing = await db.user.findUnique({ where: { email: adminEmail } });
    // Never overwrite the password of an existing admin on re-seed.
    if (!existing) await db.user.create({ data: { email: adminEmail, name: "Store Admin", passwordHash: await bcrypt.hash(adminPw, 12), roleId: role.id, emailVerifiedAt: new Date() } });
    else if (existing.roleId !== role.id) await db.user.update({ where: { id: existing.id }, data: { roleId: role.id } });
    console.log(`Admin account: ${adminEmail}`);
  } else console.warn("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin user created.");

  // Categories (parents first)
  const catId: Record<string, string> = {};
  const ordered = [...categories.filter((c) => !("parent" in c)), ...categories.filter((c) => "parent" in c)];
  let order = 0;
  for (const c of ordered) {
    const parentId = "parent" in c && c.parent ? catId[c.parent] : null;
    const row = await db.category.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, imageUrl: `/categories/${c.slug}.svg`, parentId, sortOrder: order++ },
      update: { name: c.name, description: c.description, imageUrl: `/categories/${c.slug}.svg`, parentId },
    });
    catId[c.slug] = row.id;
  }

  const colId: Record<string, string> = {};
  let co = 0;
  for (const c of collections) {
    const row = await db.collection.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, name: c.name, description: c.description, imageUrl: `/collections/${c.slug}.svg`, isFeatured: true, sortOrder: co++ },
      update: { name: c.name, description: c.description, imageUrl: `/collections/${c.slug}.svg` },
    });
    colId[c.slug] = row.id;
  }

  for (const p of products) {
    const created = new Date(Date.now() - (p.daysOld ?? 30) * 864e5);
    const base = {
      name: p.name, shortDescription: p.short, description: p.description, features: p.features, specs: p.specs, tags: p.tags,
      form: p.form, status: "ACTIVE" as const, categoryId: catId[p.category], gstRate: p.gst, hsnCode: p.hsn ?? null,
      seoDescription: p.short,
    };
    const prod = await db.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, createdAt: created, ...base }, update: base });
    await db.productImage.deleteMany({ where: { productId: prod.id, url: { startsWith: "/products/" } } });
    await db.productImage.createMany({
      data: [1, 2].map((n) => ({ productId: prod.id, url: `/products/${p.slug}-${n}.svg`, alt: n === 1 ? `${p.name} pack` : `${p.name} key features`, sortOrder: n })),
    });
    let i = 0;
    for (const v of p.variants) {
      const row = await db.productVariant.upsert({
        where: { sku: v.sku },
        create: { productId: prod.id, sku: v.sku, name: v.name, attributes: v.attrs, mrpPaise: v.mrp * 100, pricePaise: v.price * 100, weightGrams: v.grams, isDefault: i === 0, sortOrder: i },
        update: { name: v.name, attributes: v.attrs, mrpPaise: v.mrp * 100, pricePaise: v.price * 100, weightGrams: v.grams },
      });
      // Only set stock on first creation so re-seeding never resets live inventory.
      await db.inventory.upsert({ where: { variantId: row.id }, create: { variantId: row.id, quantity: v.stock }, update: {} });
      i++;
    }
    for (const [pos, c] of (p.collections ?? []).entries())
      await db.collectionProduct.upsert({ where: { collectionId_productId: { collectionId: colId[c], productId: prod.id } }, create: { collectionId: colId[c], productId: prod.id, position: pos }, update: {} });
    await syncProductDerived(prod.id, db);
  }

  const now = Date.now();
  const coupons = [
    { code: "WELCOME10", description: "10% off your order (max ₹200)", type: "PERCENT" as const, value: 10, minSubtotalPaise: 49900, maxDiscountPaise: 20000, perUserLimit: 1 },
    { code: "FLAT100", description: "₹100 off orders above ₹999", type: "FIXED" as const, value: 10000, minSubtotalPaise: 99900 },
    { code: "FREESHIP", description: "Free shipping on any order", type: "FREE_SHIPPING" as const, value: 0, minSubtotalPaise: 0, endsAt: new Date(now + 365 * 864e5) },
  ];
  for (const c of coupons) await db.coupon.upsert({ where: { code: c.code }, create: c, update: { description: c.description } });

  const zones = [
    { name: "Metro cities", pinPrefixes: ["11", "40", "56", "60", "70", "50", "38", "41"], ratePaise: 4900, etaMinDays: 2, etaMaxDays: 4, codAvailable: true },
    { name: "Rest of India", pinPrefixes: ["1", "2", "3", "4", "5", "6", "7", "8"], ratePaise: 6900, etaMinDays: 4, etaMaxDays: 8, codAvailable: true },
    { name: "North-East & J&K", pinPrefixes: ["18", "19", "78", "79"], ratePaise: 9900, etaMinDays: 7, etaMaxDays: 12, codAvailable: false },
  ];
  if ((await db.shippingZone.count()) === 0) await db.shippingZone.createMany({ data: zones });

  if ((await db.banner.count()) === 0)
    await db.banner.createMany({
      data: [
        { placement: "HERO", eyebrow: "New · Ketone drink mixes", title: "Fuel your low-carb routine", subtitle: "Sugar-free ketone salts, MCT oils and meal shakes — formulated for Indian kitchens and everyday life.", ctaLabel: "Shop supplements", linkUrl: "/category/keto-supplements", imageUrl: "/banners/hero-1.svg", theme: "dark", sortOrder: 0 },
        { placement: "HERO", eyebrow: "Whole-leaf teas", title: "Exotic leaves, straight from the estate", subtitle: "Darjeeling greens, Assam oolong and caffeine-free infusions for slower, calmer cups.", ctaLabel: "Explore teas", linkUrl: "/category/exotic-teas", imageUrl: "/banners/hero-2.svg", theme: "dark", sortOrder: 1 },
        { placement: "HERO", eyebrow: "Workout fuel", title: "Protein, electrolytes & tools", subtitle: "Plant and whey protein, zero-sugar electrolytes and a shaker that keeps up with you.", ctaLabel: "Shop workout fuel", linkUrl: "/collections/workout-fuel", imageUrl: "/banners/hero-3.svg", theme: "dark", sortOrder: 2 },
        { placement: "MID", eyebrow: "Welcome offer", title: "10% off your first order", subtitle: "Use code WELCOME10 on orders above ₹499 (max discount ₹200).", ctaLabel: "Start shopping", linkUrl: "/search", imageUrl: "/banners/mid-1.svg", theme: "gold", sortOrder: 0 },
        { placement: "MID", eyebrow: "Build your routine", title: "The Keto Starter Kit", subtitle: "A hand-picked set to begin a low-carb routine with confidence.", ctaLabel: "View the kit", linkUrl: "/collections/keto-starter-kit", imageUrl: "/banners/mid-2.svg", theme: "light", sortOrder: 1 },
      ],
    });

  console.log(`Seeded ${categories.length} categories, ${products.length} products, ${coupons.length} coupons.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
