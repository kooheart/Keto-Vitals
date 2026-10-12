import type { Coupon } from "@prisma/client";
import { db } from "./db";
import type { CouponEffect } from "./pricing";

export type CouponCheck = { ok: true } | { ok: false; reason: string };

export type CouponContext = { now: Date; subtotalPaise: number; userUses: number };

export const normalizeCoupon = (code: string) => code.trim().toUpperCase();

/** Pure rule evaluation — shared by cart preview and checkout. */
export function evaluateCoupon(
  c: Pick<Coupon, "isActive" | "startsAt" | "endsAt" | "usageLimit" | "usedCount" | "perUserLimit" | "minSubtotalPaise">,
  ctx: CouponContext,
): CouponCheck {
  if (!c.isActive) return { ok: false, reason: "This coupon is not active." };
  if (c.startsAt && ctx.now < c.startsAt) return { ok: false, reason: "This coupon is not valid yet." };
  if (c.endsAt && ctx.now > c.endsAt) return { ok: false, reason: "This coupon has expired." };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { ok: false, reason: "This coupon has been fully redeemed." };
  if (c.perUserLimit != null && ctx.userUses >= c.perUserLimit) return { ok: false, reason: "You have already used this coupon." };
  if (ctx.subtotalPaise < c.minSubtotalPaise)
    return { ok: false, reason: `Add items worth ₹${Math.ceil((c.minSubtotalPaise - ctx.subtotalPaise) / 100)} more to use this coupon.` };
  return { ok: true };
}

export const toEffect = (c: Coupon): CouponEffect =>
  c.type === "PERCENT"
    ? { type: "PERCENT", value: c.value, maxDiscountPaise: c.maxDiscountPaise }
    : c.type === "FIXED"
      ? { type: "FIXED", value: c.value }
      : { type: "FREE_SHIPPING" };

export type CouponResolution =
  | { ok: true; coupon: Coupon; effect: CouponEffect }
  | { ok: false; reason: string };

export async function resolveCoupon(
  code: string,
  opts: { subtotalPaise: number; userId?: string | null; email?: string | null; now?: Date },
): Promise<CouponResolution> {
  const coupon = await db.coupon.findUnique({ where: { code: normalizeCoupon(code) } });
  if (!coupon) return { ok: false, reason: "That coupon code is not valid." };
  let userUses = 0;
  if (coupon.perUserLimit != null && (opts.userId || opts.email)) {
    userUses = await db.couponRedemption.count({
      where: { couponId: coupon.id, order: { status: { notIn: ["CANCELLED"] } }, OR: [...(opts.userId ? [{ userId: opts.userId }] : []), ...(opts.email ? [{ email: opts.email.toLowerCase() }] : [])] },
    });
  }
  const check = evaluateCoupon(coupon, { now: opts.now ?? new Date(), subtotalPaise: opts.subtotalPaise, userUses });
  if (!check.ok) return check;
  return { ok: true, coupon, effect: toEffect(coupon) };
}
