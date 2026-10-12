import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/session";
import { getSettings, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { isRazorpayConfigured } from "@/lib/razorpay";
import { ActionForm } from "@/components/admin/action-form";
import { AField, Panel } from "@/components/admin/ui";
import { deleteZone, saveSettings, saveZone } from "../actions";
import type { ShippingZone } from "@prisma/client";

const GROUPS: [string, [SettingKey, string][]][] = [
  ["Store", [["store.name", "Store name"], ["store.tagline", "Tagline"], ["store.email", "Support email"], ["store.phone", "Support phone"], ["store.address", "Address"], ["announcement.text", "Announcement bar text (blank hides it)"]]],
  ["Shipping", [["shipping.defaultRatePaise", "Default shipping charge (₹) — used before a PIN code is known"], ["shipping.freeThresholdPaise", "Free shipping above (₹)"]]],
  ["Payments", [["payments.razorpay.enabled", "Enable online payments (Razorpay)"], ["cod.enabled", "Enable Cash on Delivery"], ["cod.feePaise", "COD handling fee (₹)"], ["cod.maxOrderPaise", "Max COD order value (₹)"]]],
  ["Tax", [["tax.shippingGstRate", "GST % applied to shipping & COD fee"]]],
  ["Social links (shown in footer when set)", [["social.instagram", "Instagram URL"], ["social.facebook", "Facebook URL"], ["social.youtube", "YouTube URL"]]],
];

function ZoneFields({ z }: { z?: ShippingZone }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
      <AField label="Zone name"><input name="name" required defaultValue={z?.name} className="input" /></AField>
      <AField label="PIN prefixes" hint="Comma-separated, longest match wins" className="lg:col-span-2"><input name="pinPrefixes" required defaultValue={z?.pinPrefixes.join(", ")} className="input" /></AField>
      <AField label="Shipping charge (₹)"><input name="rate" type="number" step="0.01" min="0" defaultValue={z ? z.ratePaise / 100 : 49} className="input" /></AField>
      <AField label="ETA min days"><input name="etaMinDays" type="number" min="0" defaultValue={z?.etaMinDays ?? 3} className="input" /></AField>
      <AField label="ETA max days"><input name="etaMaxDays" type="number" min="0" defaultValue={z?.etaMaxDays ?? 7} className="input" /></AField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="codAvailable" defaultChecked={z?.codAvailable ?? true} className="h-4 w-4 accent-brand-700" /> COD available</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={z?.isActive ?? true} className="h-4 w-4 accent-brand-700" /> Active</label>
    </div>
  );
}

export default async function Settings() {
  await requireAdminPage("settings.write");
  const [s, zones] = await Promise.all([getSettings(), db.shippingZone.findMany({ orderBy: { name: "asc" } })]);
  const keysOk = isRazorpayConfigured();
  return (
    <>
      <h1 className="mb-4 font-display text-2xl font-bold">Shipping & payment configuration</h1>
      <p className={`mb-5 rounded-lg p-3 text-sm ${keysOk ? "bg-brand-50 text-brand-900" : "bg-gold-50"}`}>{keysOk ? "Razorpay API keys are configured on the server." : "Razorpay API keys are NOT set in the server environment — online payment is unavailable at checkout until RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured. Secrets are never editable from this page."}</p>
      <ActionForm action={saveSettings} submit="Save settings" hideSubmit={false}>
        {GROUPS.map(([title, fields]) => (
          <Panel key={title} title={title}>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map(([k, label]) => {
                const def = SETTING_DEFAULTS[k];
                const v = s[k];
                if (typeof def === "boolean") return <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`s:${k}`} defaultChecked={v as boolean} className="h-4 w-4 accent-brand-700" /> {label}</label>;
                if (typeof def === "number") return <AField key={k} label={label}><input name={`s:${k}`} type="number" step="0.01" min="0" defaultValue={k.endsWith("Paise") ? (v as number) / 100 : (v as number)} className="input" /></AField>;
                return <AField key={k} label={label}><input name={`s:${k}`} defaultValue={v as string} className="input" maxLength={300} /></AField>;
              })}
            </div>
          </Panel>
        ))}
      </ActionForm>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Shipping zones</h2>
      <Panel title="Add zone"><ActionForm action={saveZone.bind(null, null)} submit="Add zone"><ZoneFields /></ActionForm></Panel>
      {zones.map((z) => <Panel key={z.id} title={z.name}><ActionForm action={saveZone.bind(null, z.id)} submit="Save zone"><ZoneFields z={z} /></ActionForm><ActionForm action={deleteZone.bind(null, z.id)} submit="Delete" danger confirm={`Delete zone ${z.name}?`} className="mt-2" /></Panel>)}
    </>
  );
}
