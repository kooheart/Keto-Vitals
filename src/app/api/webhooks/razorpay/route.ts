import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { applyPaymentSuccess, markPaymentFailed } from "@/lib/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";
import { errorResponse } from "@/lib/http";

type PaymentEntity = { id: string; order_id: string; amount: number; status: string; error_description?: string };
type Event = { event: string; payload?: { payment?: { entity?: PaymentEntity } } };

/** Razorpay → server webhook. Authenticity comes from the HMAC over the RAW body, not from the caller. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  try {
    const eventId = req.headers.get("x-razorpay-event-id");
    const evt = JSON.parse(raw) as Event;
    if (eventId) {
      // Dedupe retries: the primary key makes the second insert fail.
      try {
        await db.webhookEvent.create({ data: { id: eventId, provider: "razorpay", type: evt.event } });
      } catch {
        return NextResponse.json({ ok: true, duplicate: true });
      }
    }
    const pay = evt.payload?.payment?.entity;
    if (pay?.order_id) {
      if (evt.event === "payment.captured" || evt.event === "order.paid")
        await applyPaymentSuccess({ providerOrderId: pay.order_id, providerPaymentId: pay.id, amountPaise: pay.amount });
      else if (evt.event === "payment.failed") await markPaymentFailed(pay.order_id, pay.id, pay.error_description ?? null);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    // 5xx makes Razorpay retry; we only want that for genuine processing errors.
    return errorResponse(e);
  }
}
