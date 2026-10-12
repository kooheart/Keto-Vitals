import { describe, expect, it } from "vitest";
import { evaluateCoupon } from "@/lib/coupons";

const ok = { isActive: true, startsAt: null, endsAt: null, usageLimit: null, usedCount: 0, perUserLimit: null, minSubtotalPaise: 0 };
const ctx = { now: new Date("2026-06-15T10:00:00Z"), subtotalPaise: 60000, userUses: 0 };

describe("evaluateCoupon", () => {
  it("accepts a valid coupon", () => expect(evaluateCoupon(ok, ctx)).toEqual({ ok: true }));
  it("rejects inactive", () => expect(evaluateCoupon({ ...ok, isActive: false }, ctx).ok).toBe(false));
  it("rejects before start", () => expect(evaluateCoupon({ ...ok, startsAt: new Date("2026-07-01") }, ctx).ok).toBe(false));
  it("rejects after end", () => expect(evaluateCoupon({ ...ok, endsAt: new Date("2026-06-01") }, ctx).ok).toBe(false));
  it("rejects when usage limit reached", () => expect(evaluateCoupon({ ...ok, usageLimit: 5, usedCount: 5 }, ctx).ok).toBe(false));
  it("allows when under the usage limit", () => expect(evaluateCoupon({ ...ok, usageLimit: 5, usedCount: 4 }, ctx).ok).toBe(true));
  it("rejects when per-user limit reached", () => expect(evaluateCoupon({ ...ok, perUserLimit: 1 }, { ...ctx, userUses: 1 }).ok).toBe(false));
  it("enforces minimum subtotal and says how much more is needed", () => {
    const r = evaluateCoupon({ ...ok, minSubtotalPaise: 99900 }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/₹399/);
  });
});
