import { NextRequest, NextResponse } from "next/server";
import { suggest } from "@/lib/catalog";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { errorResponse } from "@/lib/http";

export async function GET(req: NextRequest) {
  try {
    rateLimit(`suggest:${clientIp(req.headers)}`, 120, 60_000);
    return NextResponse.json(await suggest(req.nextUrl.searchParams.get("q") ?? ""));
  } catch (e) {
    return errorResponse(e);
  }
}
