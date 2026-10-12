import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseQuery } from "@/lib/catalog";
import { Listing } from "@/components/store/listing";
import { Breadcrumbs, breadcrumbLd } from "@/components/store/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const getCat = (slug: string) => db.category.findFirst({ where: { slug, isActive: true }, include: { parent: true, children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } });

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await getCat(slug);
  if (!c) return { title: "Category not found" };
  const filtered = Object.keys(sp).length > 0;
  return {
    title: c.name,
    description: c.description ?? `Shop ${c.name} at Keto Vitals.`,
    alternates: { canonical: `/category/${c.slug}` }, // filtered/sorted variants canonicalise to the base page
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title: c.name, description: c.description ?? undefined, images: c.imageUrl ? [c.imageUrl] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const c = await getCat(slug);
  if (!c) notFound();
  const q = { ...parseQuery(sp), category: slug };
  const crumbs = [...(c.parent ? [{ label: c.parent.name, href: `/category/${c.parent.slug}` }] : []), { label: c.name }];
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd(crumbs, process.env.APP_URL ?? "")).replace(/</g, "\\u003c") }} />
      <Breadcrumbs items={crumbs} />
      <Listing q={q} basePath={`/category/${slug}`} hidden={q.q ? { q: q.q } : {}} title={c.name} subtitle={c.description ?? undefined}>
        {c.children.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{c.children.map((k) => <Link key={k.id} href={`/category/${k.slug}`} className="chip px-3 py-1 text-sm hover:bg-brand-100">{k.name}</Link>)}</div>}
      </Listing>
    </>
  );
}
