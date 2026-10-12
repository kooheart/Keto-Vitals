import { z } from "zod";
import { route, parseJson } from "@/lib/http";
import { confirmBrowserPayment } from "@/lib/orders";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({ razorpay_order_id: z.string().max(60), razorpay_payment_id: z.string().max(60), razorpay_signature: z.string().max(200) });

/**
 * Browser callback after Razorpay Checkout. The browser's word is NOT enough: we verify the HMAC
 * signature and then fetch the payment from Razorpay to confirm status + amount before marking paid.
 */
export const POST = route(async (req) => {
  rateLimit(`verify-pay:${clientIp(req.headers)}`, 30, 10 * 60_000);
  const b = await parseJson(req, schema);
  const r = await confirmBrowserPayment({ razorpayOrderId: b.razorpay_order_id, razorpayPaymentId: b.razorpay_payment_id, signature: b.razorpay_signature }, verifyCheckoutSignature);
  return { status: r.status, number: r.order?.number, orderId: r.order?.id };
});
