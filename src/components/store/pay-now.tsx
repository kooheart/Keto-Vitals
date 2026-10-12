"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiFail } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { openRazorpay } from "./razorpay-client";

export function PayNow({ orderId, email, number, token, auto }: { orderId: string; email: string; number: string; token: string; auto?: boolean }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  async function pay() {
    setBusy(true);
    try {
      const r = await api<{ keyId: string; razorpayOrderId: string; amountPaise: number }>("/api/checkout/retry", "POST", { orderId, email });
      await openRazorpay({
        keyId: r.keyId, orderId: r.razorpayOrderId, amountPaise: r.amountPaise, name: "Keto Vitals", description: `Order ${number}`, prefill: { name: "", email, contact: "" },
        onSuccess: async (resp) => { try { await api("/api/checkout/verify", "POST", resp); } catch (e) { toast({ kind: "error", message: e instanceof ApiFail ? e.message : "Could not confirm payment." }); } router.replace(`/order/${number}?t=${token}`); router.refresh(); },
        onDismiss: () => setBusy(false), onFailed: (m) => toast({ kind: "error", message: m }),
      });
    } catch (e) { toast({ kind: "error", message: e instanceof ApiFail ? e.message : "Could not start payment." }); setBusy(false); }
  }
  return <button className="btn-primary" onClick={pay} disabled={busy}>{busy ? "Opening payment…" : "Complete payment"}</button>;
}
