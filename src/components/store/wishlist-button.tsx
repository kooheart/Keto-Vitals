"use client";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Heart } from "lucide-react";
import { api, ApiFail } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";

export function WishlistButton({ productId, initial, variant = "icon" }: { productId: string; initial: boolean; variant?: "icon" | "full" }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const { toast } = useToast();
  async function toggle() {
    setBusy(true);
    try {
      await api("/api/wishlist", on ? "DELETE" : "POST", { productId });
      setOn(!on);
      toast({ kind: "success", message: on ? "Removed from wishlist" : "Saved to your wishlist", action: on ? undefined : { label: "View wishlist", href: "/wishlist" } });
      router.refresh();
    } catch (e) {
      if (e instanceof ApiFail && e.status === 401) router.push(`/login?next=${encodeURIComponent(path)}`);
      else toast({ kind: "error", message: "Could not update your wishlist." });
    } finally { setBusy(false); }
  }
  const label = on ? "Remove from wishlist" : "Add to wishlist";
  if (variant === "full")
    return <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className="btn-outline w-full"><Heart className={`h-5 w-5 ${on ? "fill-red-500 text-red-500" : ""}`} aria-hidden />{on ? "Saved to wishlist" : "Add to wishlist"}</button>;
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} aria-label={label} title={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow hover:bg-white">
      <Heart className={`h-5 w-5 ${on ? "fill-red-500 text-red-500" : "text-ink-600"}`} aria-hidden />
    </button>
  );
}
