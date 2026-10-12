import type { Metadata } from "next";
import { CartPageView } from "@/components/store/cart-view";

export const metadata: Metadata = { title: "Shopping cart", robots: { index: false } };
export default function CartPage() { return <CartPageView />; }
