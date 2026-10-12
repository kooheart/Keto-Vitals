"use client";
import { useId, useState } from "react";

export type FieldErrors = Record<string, string>;

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (p: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const desc = error ? `${fid}-err` : hint ? `${fid}-hint` : undefined;
  return (
    <div>
      <label htmlFor={fid} className="label">{label}</label>
      {children({ id: fid, "aria-invalid": error ? true : undefined, "aria-describedby": desc })}
      {hint && !error && <p id={`${fid}-hint`} className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p id={`${fid}-err`} role="alert" className="field-error">{error}</p>}
    </div>
  );
}

/** POST/PATCH JSON helper returning parsed body or throwing {message, fieldErrors}. */
export class ApiFail extends Error {
  constructor(message: string, public fieldErrors: FieldErrors = {}, public status = 0, public code?: string) { super(message); }
}
export async function api<T = any>(url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiFail("Network error. Check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiFail(data.error ?? "Something went wrong.", data.fieldErrors ?? {}, res.status, data.code);
  return data as T;
}

export function useSubmit<T>(fn: (v: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");
  const [fields, setFields] = useState<FieldErrors>({});
  return {
    busy, error, fields,
    async run(v: T) {
      setBusy(true); setError(""); setFields({});
      try { await fn(v); } catch (e) {
        if (e instanceof ApiFail) { setError(e.message); setFields(e.fieldErrors); } else setError("Something went wrong.");
      } finally { setBusy(false); }
    },
  };
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{message}</div>;
}
