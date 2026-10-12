"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type Slide = { id: string; eyebrow: string | null; title: string; subtitle: string | null; ctaLabel: string | null; linkUrl: string | null; imageUrl: string | null };

export function Hero({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [paused, slides.length]);
  if (!slides.length) return null;
  return (
    <section aria-roledescription="carousel" aria-label="Featured offers" className="relative overflow-hidden bg-brand-900 text-white" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      {slides.map((s, n) => (
        <div key={s.id} role="group" aria-roledescription="slide" aria-label={`${n + 1} of ${slides.length}`} className={`container-page items-center gap-6 py-10 md:grid-cols-2 md:py-14 lg:min-h-[460px] ${n === i ? "grid" : "hidden"}`}>
          <div>
            {s.eyebrow && <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-300">{s.eyebrow}</p>}
            {n === 0 ? <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl">{s.title}</h1> : <h2 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl">{s.title}</h2>}
            {s.subtitle && <p className="mt-4 max-w-lg text-base text-brand-100 sm:text-lg">{s.subtitle}</p>}
            <div className="mt-7 flex flex-wrap gap-3">
              {s.linkUrl && <Link href={s.linkUrl} className="btn-gold px-6">{s.ctaLabel ?? "Shop now"}</Link>}
              <Link href="/search" className="btn border border-white/30 px-6 text-white hover:bg-white/10">Browse all products</Link>
            </div>
          </div>
          {s.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imageUrl} alt="" className="mx-auto max-h-[380px] w-full max-w-lg object-contain" loading={n === 0 ? "eager" : "lazy"} />
          )}
        </div>
      ))}
      {slides.length > 1 && (
        <div className="container-page absolute inset-x-0 bottom-3 flex items-center justify-center gap-3">
          <button aria-label="Previous slide" className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" onClick={() => setI((i - 1 + slides.length) % slides.length)}><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">{slides.map((s, n) => <button key={s.id} aria-label={`Go to slide ${n + 1}`} aria-current={n === i} onClick={() => setI(n)} className={`h-2.5 rounded-full transition-all ${n === i ? "w-7 bg-gold-400" : "w-2.5 bg-white/40"}`} />)}</div>
          <button aria-label="Next slide" className="rounded-full bg-white/10 p-1.5 hover:bg-white/20" onClick={() => setI((i + 1) % slides.length)}><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
    </section>
  );
}
