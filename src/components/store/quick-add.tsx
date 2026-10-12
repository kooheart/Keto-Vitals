"use client";
import { useState } from "react";
import { useCart } from "./cart-provider";

export function QuickAdd({ variantId, name }: { variantId: string; name: string }) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);
  return (
    <button className="btn-outline btn-sm w-full" disabled={busy} aria-label={`Add ${name} to cart`} onClick={async () => { setBusy(true); await add(variantId, 1, name); setBusy(false); }}>
      {busy ? "Adding…" : "Add to cart"}
    </button>
  );
}
