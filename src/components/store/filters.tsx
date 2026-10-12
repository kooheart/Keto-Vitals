"use client";
import { useRouter, usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { SORTS, type ProductQuery } from "@/lib/catalog";

const SORT_LABEL: Record<string, string> = { relevance: "Featured", popular: "Best selling", newest: "Newest", "price-asc": "Price: low to high", "price-desc": "Price: high to low", rating: "Top rated" };

/**
 * A plain GET form: works without JS and every state lives in the URL (shareable/back-button friendly).
 * With JS it submits on change.
 */
export function Filters({ q, facets, hiddenParams }: { q: ProductQuery; facets: { tags: { value: string; count: number }[]; forms: { value: string; count: number }[] }; hiddenParams: Record<string, string> }) {
  const router = useRouter();
  const path = usePathname();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  function submit() {
    const fd = new FormData(form.current!);
    const p = new URLSearchParams();
    for (const [k, v] of fd.entries()) if (typeof v === "string" && v !== "") p.append(k, v);
    const tags = p.getAll("tags");
    if (tags.length) { p.delete("tags"); p.set("tags", tags.join(",")); }
    p.delete("page");
    router.push(`${path}?${p.toString()}`);
  }
  const sel = new Set(q.tags ?? []);
  return (
    <aside aria-label="Filters" className="lg:w-64 lg:shrink-0">
      <button type="button" className="btn-outline w-full lg:hidden" aria-expanded={open} aria-controls="filter-form" onClick={() => setOpen(!open)}><SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters & sort</button>
      <form ref={form} id="filter-form" method="get" action={path} onChange={submit} onSubmit={(e) => { e.preventDefault(); submit(); }} className={`${open ? "block" : "hidden"} mt-3 space-y-6 lg:mt-0 lg:block`}>
        {Object.entries(hiddenParams).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <div>
          <label htmlFor="sort" className="label">Sort by</label>
          <select id="sort" name="sort" defaultValue={q.sort ?? "relevance"} className="input">{SORTS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}</select>
        </div>
        <fieldset>
          <legend className="label">Price (₹)</legend>
          <div className="flex items-center gap-2">
            <input name="minPrice" type="number" min={0} inputMode="numeric" placeholder="Min" aria-label="Minimum price" defaultValue={q.minPrice} className="input" />
            <span aria-hidden>–</span>
            <input name="maxPrice" type="number" min={0} inputMode="numeric" placeholder="Max" aria-label="Maximum price" defaultValue={q.maxPrice} className="input" />
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Availability</legend>
          <label className="flex min-h-[32px] items-center gap-2 text-sm"><input type="checkbox" name="inStock" value="1" defaultChecked={q.inStock} className="h-4 w-4 accent-brand-700" /> In stock only</label>
        </fieldset>
        <fieldset>
          <legend className="label">Customer rating</legend>
          {[4, 3].map((r) => <label key={r} className="flex min-h-[32px] items-center gap-2 text-sm"><input type="radio" name="minRating" value={r} defaultChecked={q.minRating === r} className="h-4 w-4 accent-brand-700" /> {r}★ & up</label>)}
          <label className="flex min-h-[32px] items-center gap-2 text-sm"><input type="radio" name="minRating" value="" defaultChecked={!q.minRating} className="h-4 w-4 accent-brand-700" /> Any</label>
        </fieldset>
        {facets.forms.length > 0 && (
          <div>
            <label htmlFor="form" className="label">Product type</label>
            <select id="form" name="form" defaultValue={q.form ?? ""} className="input"><option value="">All types</option>{facets.forms.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count})</option>)}</select>
          </div>
        )}
        {facets.tags.length > 0 && (
          <fieldset>
            <legend className="label">Dietary & attributes</legend>
            {facets.tags.map((t) => <label key={t.value} className="flex min-h-[32px] items-center gap-2 text-sm capitalize"><input type="checkbox" name="tags" value={t.value} defaultChecked={sel.has(t.value)} className="h-4 w-4 accent-brand-700" /> {t.value.replace(/-/g, " ")}</label>)}
          </fieldset>
        )}
        <noscript><button className="btn-primary w-full">Apply filters</button></noscript>
        <a href={`${path}${hiddenParams.q ? `?q=${encodeURIComponent(hiddenParams.q)}` : ""}`} className="block text-center text-sm font-medium text-brand-700 hover:underline">Clear all filters</a>
      </form>
    </aside>
  );
}
