import crypto from "node:crypto";
import { AppError } from "./errors";

export type GatewayPayment = {
  id: string;
  order_id: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amount: number;
  currency: string;
  error_description?: string | null;
};

/** Narrow interface so the payment flow can be tested without network access. */
export interface PaymentGateway {
  createOrder(p: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
}

export const isRazorpayConfigured = () => !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

class RazorpayGateway implements PaymentGateway {
  private auth = "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: { Authorization: this.auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!res.ok) {
      // Don't forward provider error bodies to the browser; log status only.
      console.error(`[razorpay] ${path} -> ${res.status}`);
      throw new AppError(502, "The payment provider is unavailable. Please try again.", "gateway_error");
    }
    return res.json() as Promise<T>;
  }

  createOrder(p: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
    return this.call<{ id: string }>("/orders", {
      method: "POST",
      body: JSON.stringify({ amount: p.amountPaise, currency: "INR", receipt: p.receipt, notes: p.notes }),
    });
  }
  fetchPayment(id: string) {
    return this.call<GatewayPayment>(`/payments/${encodeURIComponent(id)}`);
  }
}

let override: PaymentGateway | null = null;
export const setGatewayForTests = (g: PaymentGateway | null) => (override = g);

export function getGateway(): PaymentGateway {
  if (override) return override;
  if (!isRazorpayConfigured()) throw new AppError(503, "Online payments are not configured.", "payments_unavailable");
  return new RazorpayGateway();
}

const safeEqualHex = (a: string, b: string) => {
  const A = Buffer.from(a, "utf8");
  const B = Buffer.from(b, "utf8");
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

/** Razorpay Checkout signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, secret = process.env.RAZORPAY_KEY_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook_secret). Must be computed on the *raw* body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret = process.env.RAZORPAY_WEBHOOK_SECRET): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
