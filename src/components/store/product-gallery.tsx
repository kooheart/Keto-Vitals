"use client";
import { useState } from "react";
import { ProductImage } from "@/components/ui/product-image";

/** Thumbnails + hover/tap zoom (background-position follows the pointer). */
export function ProductGallery({ images, name }: { images: { url: string; alt: string }[]; name: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const cur = images[i];
  return (
    <div>
      <div
        className="relative aspect-square cursor-zoom-in overflow-hidden rounded-xl border border-ink-100 bg-ink-50"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
        onMouseLeave={() => setZoom(null)}
        onClick={() => setZoom(zoom ? null : { x: 50, y: 50 })}
      >
        <ProductImage src={cur?.url} alt={cur?.alt ?? name} sizes="(min-width:1024px) 50vw, 100vw" priority />
        {zoom && cur && <div aria-hidden className="absolute inset-0 hidden bg-no-repeat sm:block" style={{ backgroundImage: `url(${cur.url})`, backgroundSize: "220%", backgroundPosition: `${zoom.x}% ${zoom.y}%` }} />}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2" aria-label="Product images">
          {images.map((im, n) => (
            <li key={im.url}>
              <button type="button" onClick={() => setI(n)} aria-label={`Show image ${n + 1}: ${im.alt}`} aria-current={n === i} className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 sm:h-20 sm:w-20 ${n === i ? "border-brand-600" : "border-transparent hover:border-ink-300"}`}>
                <ProductImage src={im.url} alt="" sizes="80px" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
