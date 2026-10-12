import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const url = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: { default: "Keto Vitals — Smart nutrition for weight management", template: "%s | Keto Vitals" },
  description: "Keto supplements, protein, exotic teas and healthy snacks for weight management. Free shipping over ₹499. Secure payments and Cash on Delivery across India.",
  openGraph: { type: "website", siteName: "Keto Vitals", locale: "en_IN" },
  icons: { icon: "/icon.svg" },
};
export const viewport: Viewport = { themeColor: "#134332", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
