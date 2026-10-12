import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { POLICIES } from "@/lib/policies";
import { Breadcrumbs } from "@/components/store/breadcrumbs";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return Object.keys(POLICIES).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = POLICIES[(await params).slug];
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/policies/${(await params).slug}` } } : {};
}

export default async function PolicyPage({ params }: Props) {
  const p = POLICIES[(await params).slug];
  if (!p) notFound();
  return (
    <>
      <Breadcrumbs items={[{ label: p.title }]} />
      <article className="container-page prose-kv max-w-3xl pb-10">
        <h1 className="mb-4 font-display text-3xl font-bold">{p.title}</h1>
        {process.env.POLICY_REVIEWED !== "true" && <p role="note" className="mb-5 rounded-lg border border-gold-300 bg-gold-50 p-3 text-sm">Draft template — bracketed items must be completed and the text reviewed by your legal owner before launch.</p>}
        {p.body}
      </article>
    </>
  );
}
