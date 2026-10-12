import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { releaseExpiredOrders } from "@/lib/orders";

/** Call every ~10 min (Vercel Cron / any scheduler): Authorization: Bearer $CRON_SECRET */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ok = !!secret && given.length === secret.length && crypto.timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ released: await releaseExpiredOrders(30) });
}
export const GET = POST; // Vercel Cron issues GET
