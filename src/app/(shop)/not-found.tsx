import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-20 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 font-display text-3xl font-bold">We couldn’t find that page</h1>
      <p className="mt-2 text-ink-600">The link may be out of date, or the product may no longer be available.</p>
      <div className="mt-6 flex justify-center gap-3"><Link href="/" className="btn-primary">Back to home</Link><Link href="/search" className="btn-outline">Browse products</Link></div>
    </div>
  );
}
