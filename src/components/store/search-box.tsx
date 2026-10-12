"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { formatINR } from "@/lib/money";
import { ProductImage } from "@/components/ui/product-image";

type Sug = { products: { slug: string; name: string; minPricePaise: number; images: { url: string; alt: string }[] }[]; categories: { slug: string; name: string }[] };

export function SearchBox({ initial = "" }: { initial?: string }) {
  const [q, setQ] = useState(initial);
  const [sug, setSug] = useState<Sug | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setSug(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search/suggest?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (r.ok) { setSug(await r.json()); setActive(-1); }
      } catch { /* aborted */ }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  type Link = { href: string; label: string; p?: Sug["products"][number] };
  const links: Link[] = [
    ...(sug?.categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })) ?? []),
    ...(sug?.products.map((p) => ({ href: `/product/${p.slug}`, label: p.name, p })) ?? []),
  ];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setOpen(false);
    if (active >= 0 && links[active]) return router.push(links[active].href);
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, links.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={box} className="relative w-full">
      <form role="search" onSubmit={submit} className="flex">
        <label htmlFor="site-search" className="sr-only">Search products</label>
        <input id="site-search" type="search" value={q} autoComplete="off" onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={onKey}
          placeholder="Search teas, ketone mixes, protein…" role="combobox" aria-expanded={open && links.length > 0} aria-controls="search-sug" aria-activedescendant={active >= 0 ? `sug-${active}` : undefined}
          className="input rounded-r-none border-r-0" />
        <button type="submit" className="btn-primary rounded-l-none px-4" aria-label="Search"><Search className="h-5 w-5" aria-hidden /></button>
      </form>
      {open && links.length > 0 && (
        <ul id="search-sug" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-ink-200 bg-white py-1 shadow-lg">
          {links.map((l, i) => (
            <li key={l.href} id={`sug-${i}`} role="option" aria-selected={i === active}>
              <a href={l.href} onClick={() => setOpen(false)} className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-ink-50 ${i === active ? "bg-ink-50" : ""}`}>
                {l.p ? (
                  <>
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-ink-100"><ProductImage src={l.p.images[0]?.url} alt="" sizes="40px" /></span>
                    <span className="min-w-0 flex-1 truncate">{l.label}</span>
                    <span className="text-xs text-ink-500">{formatINR(l.p.minPricePaise)}</span>
                  </>
                ) : (
                  <><Search className="h-4 w-4 text-ink-400" aria-hidden /><span>in <strong>{l.label}</strong></span><span className="ml-auto text-xs text-ink-400">Category</span></>
                )}
              </a>
            </li>
          ))}
          <li role="presentation"><a href={`/search?q=${encodeURIComponent(q)}`} className="block border-t border-ink-100 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-ink-50">See all results for “{q}”</a></li>
        </ul>
      )}
    </div>
  );
}
