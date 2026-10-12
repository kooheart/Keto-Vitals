import { CartProvider } from "@/components/store/cart-provider";
import { Footer, Header } from "@/components/store/shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider><Header /><main id="main" className="min-h-[60vh] bg-ink-50/50">{children}</main><Footer /></CartProvider>;
}
