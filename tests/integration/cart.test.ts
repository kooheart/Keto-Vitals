import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addItem, getCartView, getOrCreateCart, mergeGuestCart, removeItem, setQuantity, MAX_QTY_PER_LINE } from "@/lib/cart";
import { makeProduct, makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("cart", () => {
  it("adds, updates and removes items and recalculates server-side", async () => {
    const { variant } = await makeProduct({ price: 300, stock: 20 });
    const cart = await getOrCreateCart({ guestToken: "guest-a" });
    await addItem(cart.id, variant.id, 2);
    await addItem(cart.id, variant.id, 1); // increments
    let v = await getCartView(cart.id);
    expect(v.itemCount).toBe(3);
    expect(v.pricing.subtotalPaise).toBe(90000);
    await setQuantity(cart.id, variant.id, 5);
    v = await getCartView(cart.id);
    expect(v.pricing.subtotalPaise).toBe(150000);
    await removeItem(cart.id, variant.id);
    expect((await getCartView(cart.id)).lines).toHaveLength(0);
  });

  it("clamps quantity to available stock and the per-line maximum", async () => {
    const { variant: small } = await makeProduct({ stock: 3 });
    const { variant: big } = await makeProduct({ stock: 500 });
    const cart = await getOrCreateCart({ guestToken: "g" });
    const r = await addItem(cart.id, small.id, 10);
    expect(r).toMatchObject({ quantity: 3, clamped: true });
    const r2 = await addItem(cart.id, big.id, 99);
    expect(r2.quantity).toBe(MAX_QTY_PER_LINE);
  });

  it("refuses out-of-stock, archived/draft and unknown variants", async () => {
    const { variant: oos } = await makeProduct({ stock: 0 });
    const { variant: draft } = await makeProduct({ status: "DRAFT" });
    const cart = await getOrCreateCart({ guestToken: "g2" });
    await expect(addItem(cart.id, oos.id, 1)).rejects.toThrow(/out of stock/i);
    await expect(addItem(cart.id, draft.id, 1)).rejects.toThrow(/no longer available/i);
    await expect(addItem(cart.id, "nope", 1)).rejects.toThrow();
    await expect(addItem(cart.id, oos.id, 0)).rejects.toThrow();
  });

  it("flags lines whose stock dropped below the cart quantity", async () => {
    const { variant } = await makeProduct({ stock: 5 });
    const cart = await getOrCreateCart({ guestToken: "g3" });
    await addItem(cart.id, variant.id, 4);
    await db.inventory.update({ where: { variantId: variant.id }, data: { quantity: 2 } });
    const v = await getCartView(cart.id);
    expect(v.hasIssues).toBe(true);
    expect(v.lines[0].issue).toBe("Only 2 left");
  });

  it("always prices from the database, so later price edits are reflected", async () => {
    const { variant } = await makeProduct({ price: 100 });
    const cart = await getOrCreateCart({ guestToken: "g4" });
    await addItem(cart.id, variant.id, 1);
    await db.productVariant.update({ where: { id: variant.id }, data: { pricePaise: 12300 } });
    expect((await getCartView(cart.id)).pricing.subtotalPaise).toBe(12300);
  });

  it("merges a guest cart into the user's cart on login without duplicating lines", async () => {
    const user = await makeUser();
    const { variant: a } = await makeProduct({ stock: 20 });
    const { variant: b } = await makeProduct({ stock: 20 });
    const mine = await getOrCreateCart({ userId: user.id });
    await addItem(mine.id, a.id, 1);
    const guest = await getOrCreateCart({ guestToken: "guest-merge" });
    await addItem(guest.id, a.id, 2);
    await addItem(guest.id, b.id, 1);
    await mergeGuestCart(user.id, "guest-merge");
    const v = await getCartView(mine.id);
    expect(v.lines.find((l) => l.variantId === a.id)?.quantity).toBe(3);
    expect(v.lines.find((l) => l.variantId === b.id)?.quantity).toBe(1);
    expect(await db.cart.findUnique({ where: { id: guest.id } })).toBeNull();
  });
});
