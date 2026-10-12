import "server-only";
import { ZodError } from "zod";
import { AppError } from "../errors";
import { requirePermission } from "../auth/session";
import type { Permission } from "../auth/permissions";

export type ActionState = { ok?: string; error?: string } | null;

/**
 * Every admin server action goes through here: the permission is verified on the server
 * (not by hiding buttons), and domain errors become form messages instead of crashes.
 */
export async function guarded(perm: Permission, fn: (actor: { id: string }) => Promise<string | void>): Promise<ActionState> {
  try {
    const actor = await requirePermission(perm);
    const msg = await fn(actor);
    return { ok: msg || "Saved" };
  } catch (e) {
    if (e instanceof Error && "digest" in e && String((e as { digest?: string }).digest).startsWith("NEXT_")) throw e; // redirect / notFound
    if (e instanceof ZodError) return { error: e.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; ") };
    if (e instanceof AppError) return { error: e.message };
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") return { error: "That value is already in use (must be unique)." };
    console.error("[admin:action]", e);
    return { error: "Something went wrong. Please try again." };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const int = (fd: FormData, k: string, d = 0) => {
  const v = Number(fd.get(k));
  return Number.isFinite(v) ? Math.round(v) : d;
};
/** Rupees (may have decimals) → integer paise. */
export const paise = (fd: FormData, k: string) => Math.round(Number(fd.get(k) || 0) * 100);
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const lines = (fd: FormData, k: string) => str(fd, k).split("\n").map((l) => l.trim()).filter(Boolean);
export const kv = (fd: FormData, k: string): Record<string, string> =>
  Object.fromEntries(lines(fd, k).map((l) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; }).filter(([a]) => a));
