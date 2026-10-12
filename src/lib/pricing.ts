/**
 * Pure checkout maths. No I/O so it is trivially unit-testable.
 * Indian retail prices are GST-inclusive, so tax is the portion *contained* in the total.
 */
export type PricedLine = { unitPricePaise: number; quantity: number; gstRate: number };

export type CouponEffect =
  | { type: "PERCENT"; value: number; maxDiscountPaise?: number | null }
  | { type: "FIXED"; value: number }
  | { type: "FREE_SHIPPING" };

export type PricingInput = {
  lines: PricedLine[];
  coupon?: CouponEffect | null;
  /** Zone shipping rate; waived when the discounted subtotal reaches the threshold. */
  shippingRatePaise: number;
  freeShippingThresholdPaise: number;
  cod?: { feePaise: number } | null;
  shippingGstRate?: number;
};

export type PricingResult = {
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  codFeePaise: number;
  taxPaise: number;
  totalPaise: number;
  /** Per-line net amount after proportional discount (same order as input). */
  lineNetPaise: number[];
  freeShipping: boolean;
};

const inclusiveTax = (amount: number, rate: number) => Math.round((amount * rate) / (100 + rate));

export function couponDiscount(subtotal: number, coupon?: CouponEffect | null): number {
  if (!coupon || subtotal <= 0) return 0;
  let d = 0;
  if (coupon.type === "PERCENT") {
    d = Math.floor((subtotal * Math.min(Math.max(coupon.value, 0), 100)) / 100);
    if (coupon.maxDiscountPaise != null) d = Math.min(d, coupon.maxDiscountPaise);
  } else if (coupon.type === "FIXED") {
    d = Math.max(coupon.value, 0);
  }
  return Math.min(d, subtotal);
}

/**
 * Spread `discount` over lines proportionally to line value using the largest-remainder method,
 * so shares sum exactly to `discount` and no line is ever discounted by more than its own value.
 */
export function allocateDiscount(lineTotals: number[], discount: number): number[] {
  const sum = lineTotals.reduce((a, b) => a + b, 0);
  if (sum <= 0 || discount <= 0) return lineTotals.map(() => 0);
  const d = Math.min(discount, sum);
  const shares = lineTotals.map((t) => Math.floor((d * t) / sum));
  let left = d - shares.reduce((a, b) => a + b, 0);
  const byRemainder = lineTotals
    .map((t, i) => ({ i, rem: (d * t) % sum }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    if (shares[i] < lineTotals[i]) {
      shares[i]++;
      left--;
    }
  }
  return shares;
}

export function computeTotals(input: PricingInput): PricingResult {
  const lineTotals = input.lines.map((l) => {
    if (!Number.isInteger(l.unitPricePaise) || !Number.isInteger(l.quantity) || l.quantity < 1 || l.unitPricePaise < 0)
      throw new Error("Invalid line");
    return l.unitPricePaise * l.quantity;
  });
  const subtotal = lineTotals.reduce((a, b) => a + b, 0);
  const discount = couponDiscount(subtotal, input.coupon);
  const alloc = allocateDiscount(lineTotals, discount);
  const lineNet = lineTotals.map((t, i) => t - alloc[i]);
  const afterDiscount = subtotal - discount;

  const freeShipping =
    input.lines.length === 0 || input.coupon?.type === "FREE_SHIPPING" || afterDiscount >= input.freeShippingThresholdPaise;
  const shipping = freeShipping ? 0 : input.shippingRatePaise;
  const codFee = input.cod ? input.cod.feePaise : 0;

  const goodsTax = lineNet.reduce((a, n, i) => a + inclusiveTax(n, input.lines[i].gstRate), 0);
  const tax = goodsTax + inclusiveTax(shipping + codFee, input.shippingGstRate ?? 18);

  return {
    subtotalPaise: subtotal,
    discountPaise: discount,
    shippingPaise: shipping,
    codFeePaise: codFee,
    taxPaise: tax,
    totalPaise: afterDiscount + shipping + codFee,
    lineNetPaise: lineNet,
    freeShipping,
  };
}
