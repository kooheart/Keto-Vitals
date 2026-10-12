import { db } from "./db";

/** Admin-editable configuration with typed defaults. Amounts in paise. */
export const SETTING_DEFAULTS = {
  "store.name": "Keto Vitals",
  "store.tagline": "Smart nutrition for weight management",
  "store.email": "care@ketovitals.example",
  "store.phone": "+91 00000 00000",
  "store.address": "Keto Vitals, <Registered office address>, India",
  "social.instagram": "",
  "social.facebook": "",
  "social.youtube": "",
  "announcement.text": "Free shipping on orders above ₹499 · Use code WELCOME10 for 10% off your first order",
  "shipping.defaultRatePaise": 4900,
  "shipping.freeThresholdPaise": 49900,
  "cod.enabled": true,
  "cod.feePaise": 4000,
  "cod.maxOrderPaise": 500000,
  "payments.razorpay.enabled": true,
  "tax.shippingGstRate": 18,
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { -readonly [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends boolean ? boolean : (typeof SETTING_DEFAULTS)[K] extends number ? number : string };

export async function getSettings(): Promise<Settings> {
  const rows = await db.siteSetting.findMany();
  const out: Record<string, unknown> = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in SETTING_DEFAULTS) out[r.key] = r.value;
  return out as Settings;
}

export async function setSetting(key: SettingKey, value: string | number | boolean) {
  if (!(key in SETTING_DEFAULTS)) throw new Error(`Unknown setting ${key}`);
  const expected = typeof SETTING_DEFAULTS[key];
  if (typeof value !== expected) throw new Error(`Setting ${key} expects ${expected}`);
  await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
