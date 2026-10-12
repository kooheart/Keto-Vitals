/** Permission strings used across admin server actions and routes. "*" grants everything. */
export const PERMISSIONS = [
  "dashboard.view",
  "products.write",
  "inventory.write",
  "categories.write",
  "orders.manage",
  "customers.view",
  "coupons.write",
  "reviews.moderate",
  "marketing.write",
  "settings.write",
  "reports.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_DEFAULTS: Record<string, { description: string; permissions: string[] }> = {
  customer: { description: "Shopper", permissions: [] },
  manager: {
    description: "Store staff: catalogue, inventory, orders, reviews",
    permissions: ["dashboard.view", "products.write", "inventory.write", "categories.write", "orders.manage", "reviews.moderate", "reports.view", "customers.view"],
  },
  admin: { description: "Full access", permissions: ["*"] },
};

export const hasPermission = (perms: string[], needed: Permission) => perms.includes("*") || perms.includes(needed);
