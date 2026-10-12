/** All amounts are integer paise. Only format at the edge (UI / email). */
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

export const rupeesToPaise = (rupees: number) => Math.round(rupees * 100);

export function discountPct(mrpPaise: number, pricePaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}
