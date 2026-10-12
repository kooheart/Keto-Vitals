import type { Metadata } from "next";
import { parseQuery } from "@/lib/catalog";
import { Listing } from "@/components/store/listing";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseQuery(await searchParams);
  return { title: q.q ? `Search: ${q.q}` : "All products", robots: { index: false, follow: true }, alternates: { canonical: "/search" } };
}

export default async function SearchPage({ searchParams }: Props) {
  const q = parseQuery(await searchParams);
  return (
    <>
      <Breadcrumbs items={[{ label: q.q ? "Search results" : "All products" }]} />
      <Listing q={q} basePath="/search" hidden={q.q ? { q: q.q } : {}} title={q.q ? `Results for “${q.q}”` : "All products"} />
    </>
  );
}
