"use client";

declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, cb: (r: any) => void): void } } }

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((res) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => res(true);
    s.onerror = () => res(false);
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout. The success callback is NOT proof of payment — the server re-verifies. */
export async function openRazorpay(o: { keyId: string; orderId: string; amountPaise: number; name: string; description: string; prefill: { name: string; email: string; contact: string }; onSuccess: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void; onDismiss: () => void; onFailed: (msg: string) => void }) {
  if (!(await loadScript()) || !window.Razorpay) { o.onFailed("Could not load the payment window. Check your connection."); return o.onDismiss(); }
  const rz = new window.Razorpay({
    key: o.keyId, order_id: o.orderId, amount: o.amountPaise, currency: "INR", name: o.name, description: o.description, prefill: o.prefill, theme: { color: "#1a6648" },
    handler: o.onSuccess, modal: { ondismiss: o.onDismiss },
  });
  rz.on("payment.failed", (r: any) => o.onFailed(r?.error?.description ?? "Payment failed. Please try again."));
  rz.open();
}
