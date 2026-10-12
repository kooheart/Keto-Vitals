import type { OrderStatus } from "@prisma/client";

/** Allowed manual/system transitions. Anything else is rejected. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PLACED", "CANCELLED"],
  PLACED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: ["REFUNDED"],
  REFUNDED: [],
};

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to);
export const nextStatuses = (from: OrderStatus) => TRANSITIONS[from];

/** Statuses after which stock is no longer held for the order. */
export const RELEASES_STOCK: OrderStatus[] = ["CANCELLED"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PLACED: "Order placed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
