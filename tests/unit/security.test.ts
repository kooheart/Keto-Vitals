import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/razorpay";
import { rateLimit, _resetRateLimits } from "@/lib/rate-limit";
import { detectImage } from "@/lib/storage";
import { assertSameOrigin } from "@/lib/http";
import { passwordSchema, phoneSchema, addressSchema } from "@/lib/validation";
import { hasPermission } from "@/lib/auth/permissions";

const hmac = (secret: string, s: string) => crypto.createHmac("sha256", secret).update(s).digest("hex");

describe("Razorpay signatures", () => {
  it("accepts a correct checkout signature", () => expect(verifyCheckoutSignature("order_1", "pay_1", hmac("k", "order_1|pay_1"), "k")).toBe(true));
  it("rejects a tampered payment id", () => expect(verifyCheckoutSignature("order_1", "pay_2", hmac("k", "order_1|pay_1"), "k")).toBe(false));
  it("rejects wrong secret / empty signature / wrong length", () => {
    expect(verifyCheckoutSignature("o", "p", hmac("other", "o|p"), "k")).toBe(false);
    expect(verifyCheckoutSignature("o", "p", "", "k")).toBe(false);
    expect(verifyCheckoutSignature("o", "p", "abc", "k")).toBe(false);
  });
  it("verifies webhooks against the raw body", () => {
    const body = '{"event":"payment.captured"}';
    expect(verifyWebhookSignature(body, hmac("w", body), "w")).toBe(true);
    expect(verifyWebhookSignature(body + " ", hmac("w", body), "w")).toBe(false);
    expect(verifyWebhookSignature(body, null, "w")).toBe(false);
  });
});

describe("rateLimit", () => {
  it("blocks after the max and resets after the window", () => {
    _resetRateLimits();
    for (let i = 0; i < 3; i++) rateLimit("k", 3, 1000, 0);
    expect(() => rateLimit("k", 3, 1000, 10)).toThrow(/Too many/);
    expect(() => rateLimit("k", 3, 1000, 1500)).not.toThrow();
  });
});

describe("upload validation", () => {
  it("recognises real image magic bytes and rejects others", () => {
    expect(detectImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext).toBe("jpg");
    expect(detectImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe("png");
    expect(detectImage(Buffer.from("<svg onload=alert(1)></svg>"))).toBeUndefined();
    expect(detectImage(Buffer.from("<?php echo 1;"))).toBeUndefined();
  });
});

describe("CSRF origin check", () => {
  const mk = (h: Record<string, string>) => new Request("http://localhost:3000/api/x", { method: "POST", headers: h });
  it("allows same-origin and header-less clients", () => {
    expect(() => assertSameOrigin(mk({ origin: "http://localhost:3000", host: "localhost:3000" }))).not.toThrow();
    expect(() => assertSameOrigin(mk({ host: "localhost:3000" }))).not.toThrow();
  });
  it("blocks cross-site origins", () => {
    expect(() => assertSameOrigin(mk({ origin: "https://evil.example", host: "localhost:3000" }))).toThrow();
    expect(() => assertSameOrigin(mk({ "sec-fetch-site": "cross-site", host: "localhost:3000" }))).toThrow();
  });
});

describe("validation", () => {
  it("password policy", () => {
    expect(passwordSchema.safeParse("short1").success).toBe(false);
    expect(passwordSchema.safeParse("alllettersnonumber").success).toBe(false);
    expect(passwordSchema.safeParse("goodpassword123").success).toBe(true);
  });
  it("normalises Indian phone numbers", () => {
    expect(phoneSchema.parse("+91 98765-43210")).toBe("9876543210");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
  it("validates PIN codes", () => {
    const a = { fullName: "A B", phone: "9876543210", line1: "1 Street", city: "Pune", state: "Maharashtra" };
    expect(addressSchema.safeParse({ ...a, pincode: "411001" }).success).toBe(true);
    expect(addressSchema.safeParse({ ...a, pincode: "011001" }).success).toBe(false);
    expect(addressSchema.safeParse({ ...a, pincode: "4110" }).success).toBe(false);
  });
});

describe("permissions", () => {
  it("wildcard grants all; others are explicit", () => {
    expect(hasPermission(["*"], "orders.manage")).toBe(true);
    expect(hasPermission(["products.write"], "orders.manage")).toBe(false);
    expect(hasPermission([], "dashboard.view")).toBe(false);
  });
});
