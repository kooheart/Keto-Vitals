import type { ReactNode } from "react";

export const AField = ({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) => (
  <label className={`block ${className}`}><span className="label">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}</label>
);
export const Panel = ({ title, children, actions }: { title?: string; children: ReactNode; actions?: ReactNode }) => (
  <section className="card mb-6 p-5">{(title || actions) && <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{title}</h2>{actions}</div>}{children}</section>
);
export const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="card p-5"><p className="text-sm text-ink-500">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p>{sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}</div>
);
export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="overflow-x-auto rounded-xl border border-ink-100"><table className="w-full text-left text-sm"><thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500"><tr>{head.map((h) => <th key={h} className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink-100">{children}</tbody></table></div>
);
export const td = "px-4 py-3 align-top";
