"use client";
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container-page py-20 text-center" role="alert">
      <h1 className="font-display text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-ink-600">We couldn’t load this page. Please try again.{error.digest && <span className="block text-xs text-ink-400">Reference: {error.digest}</span>}</p>
      <button onClick={reset} className="btn-primary mt-6">Try again</button>
    </div>
  );
}
