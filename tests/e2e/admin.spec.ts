import { expect, test } from "@playwright/test";

const login = async (page: import("@playwright/test").Page, email: string, password: string) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
};

test("anonymous visitors cannot reach the admin area", async ({ page }) => {
  await page.goto("/admin/orders");
  await page.waitForURL(/\/login\?next=/);
  const res = await page.request.get("/admin", { maxRedirects: 0 });
  expect([307, 308, 200]).toContain(res.status());
  expect(await res.text()).not.toContain("Sales reports");
});

test("a customer account is denied admin pages", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Plain Customer");
  await page.getByLabel("Email", { exact: true }).fill(`cust${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("Sup3rSecret99");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
  await page.goto("/admin/products");
  await page.waitForURL(/\/\?denied=1/);
  await expect(page.getByText("Inventory", { exact: true })).toHaveCount(0);
});

test("admin: place order as customer, then manage it end-to-end", async ({ page, browser }) => {
  test.setTimeout(150_000);
  // 1) a guest places a COD order for the last units of a product
  const shopper = await (await browser.newContext({ baseURL: test.info().project.use.baseURL })).newPage();
  await shopper.goto("/product/nilgiri-silver-needle-white-tea");
  await shopper.locator('[data-testid="add-to-cart"]:visible').click();
  await expect(shopper.getByTestId("cart-count")).toHaveText("1");
  await shopper.goto("/checkout");
  await shopper.getByLabel("Email", { exact: true }).fill("buyer@example.com");
  await shopper.getByLabel("Mobile number").fill("9876543210");
  await shopper.getByLabel("Full name").fill("Buyer One");
  await shopper.getByLabel("Address (house no., street)").fill("1 Park Street");
  await shopper.getByLabel("PIN code").fill("700001");
  await shopper.getByLabel("City").fill("Kolkata");
  await shopper.getByLabel("State").selectOption("West Bengal");
  await shopper.getByLabel(/Cash on Delivery/).check();
  await shopper.getByTestId("place-order").click();
  await shopper.waitForURL(/\/order\/KV-/);
  const number = await shopper.getByTestId("order-number").innerText();

  // 2) admin signs in and works the order
  await login(page, "admin@e2e.test", "E2eAdmin#123");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await page.goto("/admin/orders");
  await page.getByRole("link", { name: number }).click();
  await page.getByLabel("New status").selectOption("PROCESSING");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order marked processing")).toBeVisible();
  await page.reload();
  await page.getByLabel("New status").selectOption("SHIPPED");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByRole("alert")).toContainText("tracking number"); // server rule
  await page.getByLabel("Carrier").fill("Delhivery");
  await page.getByLabel("Tracking number").fill("DL0001");
  await page.getByRole("button", { name: "Update order" }).click();
  await expect(page.getByText("Order marked shipped")).toBeVisible();

  // 3) customer sees the tracking info
  await shopper.reload();
  await expect(shopper.getByText("DL0001")).toBeVisible();

  // 4) inventory + product + coupon management
  await page.goto("/admin/inventory?q=KV-NWT-30");
  const qty = page.getByLabel("Quantity for KV-NWT-30");
  await expect(qty).toHaveValue("24");
  await qty.fill("5");
  await page.getByRole("button", { name: "Update" }).click();
  await expect(page.getByText("Stock updated")).toBeVisible();
  await page.goto("/admin/coupons");
  await page.getByLabel("Code").first().fill("E2E15");
  await page.getByLabel("Value").first().fill("15");
  await page.getByRole("button", { name: "Create coupon" }).click();
  await expect(page.getByText("Coupon saved")).toBeVisible();
  await page.goto("/admin/products/new");
  await page.getByLabel("Name").fill("E2E Test Product");
  await page.getByLabel("Category").selectOption({ label: "Keto Snacks & Sweeteners" });
  await page.getByRole("button", { name: "Create product" }).click();
  await page.waitForURL(/\/admin\/products\/.+created=1/);
  await page.goto("/admin/reports");
  await expect(page.getByRole("heading", { name: "Sales reports" })).toBeVisible();
  await page.goto("/admin/settings");
  await expect(page.getByText("Razorpay API keys are NOT set")).toBeVisible();
});
