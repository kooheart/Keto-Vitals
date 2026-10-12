import { Star } from "lucide-react";

export function Stars({ value, count, size = "h-4 w-4" }: { value: number; count?: number; size?: string }) {
  if (!count) return <span className="text-xs text-ink-400">No reviews yet</span>;
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Rated ${value} out of 5 from ${count} reviews`}>
      <span className="inline-flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`${size} ${value >= i - 0.25 ? "fill-gold-400 text-gold-400" : value >= i - 0.75 ? "fill-gold-300/60 text-gold-400" : "text-ink-300"}`} />
        ))}
      </span>
      <span className="text-xs text-ink-500">{value.toFixed(1)} ({count})</span>
    </span>
  );
}
