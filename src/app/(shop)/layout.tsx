import { CartProvider } from "@/components/store/cart-provider";
import { Footer, Header } from "@/components/store/shell";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer />
    </CartProvider>
  );
}
