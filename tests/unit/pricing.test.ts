import { describe, expect, it } from "vitest";
import { allocateDiscount, computeTotals, couponDiscount } from "@/lib/pricing";

const base = { shippingRatePaise: 5000, freeShippingThresholdPaise: 49900 };

describe("computeTotals", () => {
  it("sums lines, adds shipping below the free-shipping threshold", () => {
    const r = computeTotals({ ...base, lines: [{ unitPricePaise: 19900, quantity: 2, gstRate: 18 }] });
    expect(r.subtotalPaise).toBe(39800);
    expect(r.shippingPaise).toBe(5000);
    expect(r.totalPaise).toBe(44800);
  });

  it("waives shipping at/above the threshold", () => {
    const r = computeTotals({ ...base, lines: [{ unitPricePaise: 49900, quantity: 1, gstRate: 5 }] });
    expect(r.shippingPaise).toBe(0);
    expect(r.freeShipping).toBe(true);
    expect(r.totalPaise).toBe(49900);
  });

  it("applies the threshold to the post-discount amount", () => {
    const r = computeTotals({ ...base, lines: [{ unitPricePaise: 50000, quantity: 1, gstRate: 18 }], coupon: { type: "FIXED", value: 5000 } });
    expect(r.discountPaise).toBe(5000);
    expect(r.shippingPaise).toBe(5000); // 45000 < 49900
    expect(r.totalPaise).toBe(45000 + 5000);
  });

  it("percent coupon honours the max-discount cap", () => {
    expect(couponDiscount(100000, { type: "PERCENT", value: 10, maxDiscountPaise: 5000 })).toBe(5000);
    expect(couponDiscount(100000, { type: "PERCENT", value: 10 })).toBe(10000);
  });

  it("never discounts below zero", () => {
    expect(couponDiscount(3000, { type: "FIXED", value: 10000 })).toBe(3000);
    expect(couponDiscount(0, { type: "FIXED", value: 100 })).toBe(0);
  });

  it("FREE_SHIPPING coupon waives shipping without a discount", () => {
    const r = computeTotals({ ...base, lines: [{ unitPricePaise: 10000, quantity: 1, gstRate: 18 }], coupon: { type: "FREE_SHIPPING" } });
    expect(r.discountPaise).toBe(0);
    expect(r.shippingPaise).toBe(0);
  });

  it("adds COD fee to the total", () => {
    const r = computeTotals({ ...base, lines: [{ unitPricePaise: 60000, quantity: 1, gstRate: 18 }], cod: { feePaise: 4000 } });
    expect(r.codFeePaise).toBe(4000);
    expect(r.totalPaise).toBe(64000);
  });

  it("computes GST contained in a tax-inclusive price", () => {
    // ₹118 inclusive of 18% GST contains ₹18 tax.
    const r = computeTotals({ ...base, shippingRatePaise: 0, lines: [{ unitPricePaise: 11800, quantity: 1, gstRate: 18 }] });
    expect(r.taxPaise).toBe(1800);
  });

  it("allocated line discounts always sum to the total discount", () => {
    for (const [totals, d] of [[[3333, 3333, 3334], 1001], [[100, 200, 300], 7], [[1, 1, 1], 2]] as [number[], number][]) {
      const a = allocateDiscount(totals, d);
      expect(a.reduce((x, y) => x + y, 0)).toBe(d);
      a.forEach((x, i) => expect(x).toBeLessThanOrEqual(totals[i]));
    }
  });

  it("total = sum(line nets) + shipping + cod", () => {
    const r = computeTotals({ ...base, cod: { feePaise: 4000 }, coupon: { type: "PERCENT", value: 15 }, lines: [{ unitPricePaise: 12345, quantity: 3, gstRate: 12 }, { unitPricePaise: 999, quantity: 1, gstRate: 5 }] });
    expect(r.lineNetPaise.reduce((a, b) => a + b, 0) + r.shippingPaise + r.codFeePaise).toBe(r.totalPaise);
  });

  it("rejects invalid lines", () => {
    expect(() => computeTotals({ ...base, lines: [{ unitPricePaise: 100.5, quantity: 1, gstRate: 5 }] })).toThrow();
    expect(() => computeTotals({ ...base, lines: [{ unitPricePaise: 100, quantity: 0, gstRate: 5 }] })).toThrow();
  });
});
