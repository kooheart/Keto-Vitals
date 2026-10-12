import { NextRequest, NextResponse } from "next/server";
import { checkPincode, etaText } from "@/lib/shipping";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    rateLimit(`pin:${clientIp(req.headers)}`, 60, 60_000);
    const r = await checkPincode(req.nextUrl.searchParams.get("pin") ?? "");
    if (!r.serviceable) return NextResponse.json(r);
    return NextResponse.json({ ...r, eta: etaText(r.etaMinDays, r.etaMaxDays) });
  } catch (e) {
    return errorResponse(e);
  }
}
