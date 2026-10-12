import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseQuery } from "@/lib/catalog";
import { Listing } from "@/components/store/listing";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };
const get = (slug: string) => db.collection.findFirst({ where: { slug, isActive: true } });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await get((await params).slug);
  return c ? { title: c.name, description: c.description ?? undefined, alternates: { canonical: `/collections/${c.slug}` } } : { title: "Collection not found" };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const c = await get(slug);
  if (!c) notFound();
  const q = { ...parseQuery(await searchParams), collection: slug };
  return (
    <>
      <Breadcrumbs items={[{ label: "Collections" }, { label: c.name }]} />
      <Listing q={q} basePath={`/collections/${slug}`} hidden={{}} title={c.name} subtitle={c.description ?? undefined} />
    </>
  );
}
