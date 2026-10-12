import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { ToastProvider } from "@/components/ui/toast";
import { LogoutButton } from "@/components/store/header-bits";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

const NAV: [string, string, Permission][] = [
  ["/admin", "Overview", "dashboard.view"], ["/admin/orders", "Orders", "orders.manage"], ["/admin/products", "Products", "products.write"], ["/admin/inventory", "Inventory", "inventory.write"],
  ["/admin/categories", "Categories", "categories.write"], ["/admin/collections", "Collections", "categories.write"], ["/admin/customers", "Customers", "customers.view"], ["/admin/coupons", "Coupons", "coupons.write"],
  ["/admin/reviews", "Reviews", "reviews.moderate"], ["/admin/banners", "Homepage banners", "marketing.write"], ["/admin/reports", "Reports", "reports.view"], ["/admin/settings", "Shipping & payments", "settings.write"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireAdminPage(); // server-side gate; each page and action re-checks its own permission
  return (
    <ToastProvider>
      <div className="min-h-screen bg-ink-50 lg:grid lg:grid-cols-[15rem_1fr]">
        <aside className="bg-brand-950 p-4 text-brand-100 lg:min-h-screen">
          <Link href="/admin" className="mb-4 block font-display text-lg font-bold text-white">Keto Vitals <span className="text-gold-400">Admin</span></Link>
          <nav aria-label="Admin"><ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {NAV.filter(([, , p]) => hasPermission(u.permissions, p)).map(([h, l]) => <li key={h}><Link href={h} className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-white/10">{l}</Link></li>)}
          </ul></nav>
          <div className="mt-6 hidden border-t border-white/10 pt-4 text-xs lg:block"><p className="truncate">{u.name} · {u.role}</p><Link href="/" className="mt-2 block underline">View store</Link><LogoutButton className="mt-1 underline" /></div>
        </aside>
        <div className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </ToastProvider>
  );
}
