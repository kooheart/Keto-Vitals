import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses } from "@/lib/order-status";

describe("order status machine", () => {
  it("allows the happy path", () => {
    expect(canTransition("PENDING_PAYMENT", "PLACED")).toBe(true);
    expect(canTransition("PLACED", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });
  it("blocks skipping steps and going backwards", () => {
    expect(canTransition("PLACED", "SHIPPED")).toBe(false);
    expect(canTransition("SHIPPED", "PROCESSING")).toBe(false);
    expect(canTransition("DELIVERED", "PLACED")).toBe(false);
  });
  it("does not allow cancelling after shipment", () => {
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
  });
  it("refunded is terminal", () => expect(nextStatuses("REFUNDED")).toEqual([]));
});
