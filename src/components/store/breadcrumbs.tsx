import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ label: "Home", href: "/" }, ...items];
  return (
    <nav aria-label="Breadcrumb" className="container-page py-3 text-xs text-ink-500 sm:text-sm">
      <ol className="flex flex-wrap items-center gap-1">
        {all.map((c, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
            {c.href && i < all.length - 1 ? <Link href={c.href} className="hover:text-brand-700 hover:underline">{c.label}</Link> : <span aria-current={i === all.length - 1 ? "page" : undefined} className="text-ink-700">{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** JSON-LD BreadcrumbList for search engines. */
export function breadcrumbLd(items: Crumb[], base: string) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ label: "Home", href: "/" }, ...items].map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, ...(c.href ? { item: base + c.href } : {}) })) };
}
