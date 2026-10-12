import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError, badRequest } from "./errors";

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: NextRequest, ctx: Ctx) => Promise<Response | unknown>;

/** Same-origin check for state-changing requests (CSRF defence in depth on top of SameSite=Lax). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    // Non-browser clients (curl, tests) send no Origin; browsers always do on cross-site POSTs.
    if (req.headers.get("sec-fetch-site") === "cross-site") throw new AppError(403, "Cross-site request blocked", "csrf");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError(403, "Bad origin", "csrf");
  }
  if (originHost !== host) throw new AppError(403, "Cross-site request blocked", "csrf");
}

export function route(handler: Handler, opts: { csrf?: boolean } = {}) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      if (opts.csrf !== false && !["GET", "HEAD", "OPTIONS"].includes(req.method)) assertSameOrigin(req);
      const out = await handler(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const i of e.issues) fieldErrors[i.path.join(".") || "_"] ??= i.message;
    return NextResponse.json({ error: "Please check the highlighted fields.", code: "validation", fieldErrors }, { status: 400 });
  }
  if (e instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = (e.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (e.status === 429 && retry) headers["Retry-After"] = String(retry);
    return NextResponse.json({ error: e.message, code: e.code, details: e.details }, { status: e.status, headers });
  }
  // Log server-side only; never leak internals to the client.
  console.error("[api:error]", e instanceof Error ? e.stack ?? e.message : e);
  return NextResponse.json({ error: "Something went wrong. Please try again.", code: "internal" }, { status: 500 });
}

export async function parseJson<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(body);
}
