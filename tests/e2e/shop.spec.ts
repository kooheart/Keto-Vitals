import { expect, test, type Page } from "@playwright/test";

const addrFill = async (page: Page, over: Partial<Record<string, string>> = {}) => {
  const v = { email: "guest@example.com", phone: "9876543210", fullName: "Guest Buyer", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", pincode: "560001", ...over };
  await page.getByLabel("Email", { exact: true }).fill(v.email!);
  await page.getByLabel("Mobile number").fill(v.phone!);
  await page.getByLabel("Full name").fill(v.fullName!);
  await page.getByLabel("Address (house no., street)").fill(v.line1!);
  await page.getByLabel("PIN code").fill(v.pincode!);
  await page.getByLabel("City").fill(v.city!);
  await page.getByLabel("State").selectOption(v.state!);
};

test("homepage renders key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("announcement")).toContainText("Free shipping");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const h of ["Shop by category", "Best sellers", "New arrivals", "Featured collections"]) await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Customer service");
  expect(await page.getByTestId("product-card").count()).toBeGreaterThan(8);
});

test("category page: filters, sort and shareable URL", async ({ page }) => {
  await page.goto("/category/exotic-teas");
  await expect(page.getByRole("heading", { name: "Exotic Teas & Infusions" })).toBeVisible();
  const all = await page.getByTestId("product-card").count();
  expect(all).toBeGreaterThan(3);
  await page.goto("/category/exotic-teas?sort=price-asc&inStock=1&tags=caffeine-free");
  await page.locator('[data-testid="product-card"]:visible').first().waitFor();
  const prices = await page.locator('[data-testid="product-card"]:visible span.text-lg').allInnerTexts();
  const nums = prices.map((p) => Number(p.replace(/[^\d.]/g, "")));
  expect(nums.length).toBeGreaterThan(0);
  expect(nums, JSON.stringify(prices)).toEqual([...nums].sort((a, b) => a - b));
  await expect(page.getByTestId("result-count").first()).toContainText("product");
  await page.goto("/category/exotic-teas?minPrice=99999");
  await expect(page.locator('[data-testid="empty-state"]:visible')).toBeVisible();
});

test("search, suggestions and no-results state", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Search products" }).first().fill("darj");
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("combobox", { name: "Search products" }).first().press("Enter");
  await expect(page).toHaveURL(/search\?q=darj/);
  await expect(page.getByTestId("product-card").first()).toContainText("Darjeeling");
  await page.goto("/search?q=zzzzqqq");
  await expect(page.locator('[data-testid="empty-state"]:visible')).toContainText("No products match");
});

test("product page: variants, pincode check, SEO data", async ({ page }) => {
  await page.goto("/product/darjeeling-green-tea");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Darjeeling");
  await expect(page).toHaveTitle(/Darjeeling/);
  const before = await page.getByTestId("price").innerText();
  await page.getByRole("button", { name: /100 g tin/ }).click();
  await expect(page.getByTestId("price")).not.toHaveText(before);
  await page.getByLabel(/Check delivery/).fill("560001");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: /Delivery by/ })).toBeVisible();
  await page.getByLabel(/Check delivery/).fill("999999");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText(/do not deliver|valid/)).toBeVisible();
  const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').first().innerText());
  expect(ld["@type"]).toBe("Product");
  expect(ld.offers[0].priceCurrency).toBe("INR");
  expect(ld.aggregateRating).toBeUndefined(); // no reviews → no fabricated rating
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/product\/darjeeling-green-tea$/);
});

test("out-of-stock variant cannot be added", async ({ page }) => {
  await page.goto("/product/keto-ketone-salts-lemon");
  await expect(page.locator('[data-testid="stock"]:visible')).toHaveText("Out of stock");
  await expect(page.locator('[data-testid="add-to-cart"]:visible')).toBeDisabled();
});

test("guest cart → coupon → COD checkout → confirmation → tracking", async ({ page }) => {
  await page.goto("/product/tulsi-ginger-infusion");
  await page.locator('[data-testid="add-to-cart"]:visible').click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.reload();
  await expect(page.getByTestId("cart-count")).toHaveText("1"); // persists across refresh
  await page.goto("/cart");
  await page.getByRole("button", { name: "Increase quantity" }).click();
  await expect(page.getByTestId("cart-line").locator("output")).toHaveText("2");
  await page.getByLabel("Have a coupon?").fill("NOPE");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /not valid/ })).toBeVisible();
  await page.goto("/checkout");
  await addrFill(page);
  await expect(page.getByText(/We deliver to 560001/)).toBeVisible();
  await page.getByLabel(/Cash on Delivery/).check();
  await page.getByTestId("place-order").click();
  await page.waitForURL(/\/order\/KV-/);
  await expect(page.getByTestId("order-number")).toBeVisible();
  const number = await page.getByTestId("order-number").innerText();
  await expect(page.getByText("Cash on Delivery · Pay on delivery")).toBeVisible();
  // order page is not accessible without the signed token
  const bare = await page.request.get(`/order/${number}`);
  const html = await bare.text();
  expect(html).not.toContain("Guest Buyer"); // no order data without the signed token (page streams a not-found view)
  expect(html).not.toContain("12 MG Road");
  // guest tracking requires matching email
  await page.goto("/track");
  await page.getByLabel("Order number").fill(number);
  await page.getByLabel(/Email used/).fill("wrong@example.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText("We couldn’t find an order with those details.")).toBeVisible();
  await page.getByLabel(/Email used/).fill("guest@example.com");
  await page.getByRole("button", { name: "Track order" }).click();
  await page.waitForURL(/\/order\//);
  await expect(page.getByText("Order placed").first()).toBeVisible();
});

test("account: register merges guest cart; wishlist; address; login/logout", async ({ page }) => {
  await page.goto("/product/turmeric-masala-chai");
  await page.locator('[data-testid="add-to-cart"]:visible').click();
  await expect(page.getByTestId("cart-count")).toHaveText("1");
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Meera Iyer");
  await page.getByLabel("Email", { exact: true }).fill(`meera${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  await page.getByLabel("Password").fill("Sup3rSecret99");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("/");
  await expect(page.getByTestId("cart-count")).toHaveText("1"); // merged into the account cart
  // wishlist
  await page.goto("/product/darjeeling-green-tea");
  await page.getByRole("button", { name: /Add to wishlist/ }).first().click();
  await expect(page.getByText("Saved to your wishlist")).toBeVisible(); // wait for the API call to finish
  await page.goto("/wishlist");
  await expect(page.getByTestId("product-card")).toHaveCount(1);
  // address book
  await page.goto("/account/addresses");
  await page.getByRole("button", { name: "Add new address" }).click();
  await page.getByLabel("Full name").fill("Meera Iyer");
  await page.getByLabel("Mobile").fill("9876543210");
  await page.getByLabel("Address", { exact: true }).fill("5 Lake View");
  await page.getByLabel("PIN code").fill("400001");
  await page.getByLabel("City").fill("Mumbai");
  await page.getByLabel("State").selectOption("Maharashtra");
  await page.getByRole("button", { name: "Save address" }).click();
  await expect(page.getByText("5 Lake View")).toBeVisible();
  // protected route redirects once signed out
  await page.getByRole("link", { name: /Meera/ }).hover();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/account/orders");
  await page.waitForURL(/\/login\?next=/);
});

test("responsive: no horizontal overflow and mobile navigation works", async ({ page }) => {
  for (const [w, h] of [[375, 800], [768, 1000], [1280, 900]] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const url of ["/", "/category/keto-supplements", "/product/mct-oil-c8-c10", "/cart"]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${url} @${w}px`).toBeLessThanOrEqual(1);
    }
  }
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Exotic Teas & Infusions" }).click();
  await expect(page).toHaveURL(/category\/exotic-teas/);
});
