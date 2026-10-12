import { db } from "./db";

export const PIN_RE = /^[1-9][0-9]{5}$/;
export const isValidPin = (p: string) => PIN_RE.test(p);

export type Serviceability =
  | { serviceable: true; zoneName: string; ratePaise: number; etaMinDays: number; etaMaxDays: number; codAvailable: boolean; city?: string; state?: string }
  | { serviceable: false; reason: string };

/** Longest-prefix match against admin-configured zones. */
export async function checkPincode(pin: string): Promise<Serviceability> {
  if (!isValidPin(pin)) return { serviceable: false, reason: "Enter a valid 6-digit PIN code." };
  const zones = await db.shippingZone.findMany({ where: { isActive: true } });
  let best: { z: (typeof zones)[number]; len: number } | null = null;
  for (const z of zones)
    for (const p of z.pinPrefixes) if (pin.startsWith(p) && (!best || p.length > best.len)) best = { z, len: p.length };
  if (!best) return { serviceable: false, reason: "Sorry, we do not deliver to this PIN code yet." };
  const loc = await lookupPostOffice(pin);
  return {
    serviceable: true,
    zoneName: best.z.name,
    ratePaise: best.z.ratePaise,
    etaMinDays: best.z.etaMinDays,
    etaMaxDays: best.z.etaMaxDays,
    codAvailable: best.z.codAvailable,
    ...loc,
  };
}

/** Best-effort city/state from India Post's public API. Never blocks checkout if unavailable. */
export async function lookupPostOffice(pin: string): Promise<{ city?: string; state?: string }> {
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } });
    if (!res.ok) return {};
    const data = (await res.json()) as Array<{ Status: string; PostOffice?: Array<{ District: string; State: string }> }>;
    const po = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : undefined;
    return po ? { city: po.District, state: po.State } : {};
  } catch {
    return {};
  }
}

export function etaText(min: number, max: number, from = new Date()): string {
  const f = (d: number) => {
    const x = new Date(from);
    x.setDate(x.getDate() + d);
    return x.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };
  return `${f(min)} – ${f(max)}`;
}

export const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
] as const;
