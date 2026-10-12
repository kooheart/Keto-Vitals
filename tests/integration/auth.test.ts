import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { authenticate, changePassword, registerUser, requestPasswordReset, resetPassword, verifyEmailToken } from "@/lib/auth/service";
import { sha256 } from "@/lib/auth/password";
import { makeUser, resetDb } from "./helpers";

beforeEach(resetDb);

describe("authentication", () => {
  it("registers (hashing the password), lower-cases email, and rejects duplicates", async () => {
    const u = await registerUser({ name: "Asha", email: "Asha@Example.com", password: "Sup3rSecret!!" });
    expect(u.email).toBe("asha@example.com");
    expect(u.passwordHash).not.toContain("Sup3rSecret");
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
    await expect(registerUser({ name: "Dup", email: "asha@example.com", password: "Sup3rSecret!!" })).rejects.toMatchObject({ status: 409 });
    expect((await db.role.findUniqueOrThrow({ where: { id: u.roleId } })).name).toBe("customer");
  });

  it("logs in with correct credentials only; error does not reveal whether the email exists", async () => {
    await registerUser({ name: "A", email: "a@example.com", password: "Sup3rSecret!!" });
    expect((await authenticate("A@EXAMPLE.com", "Sup3rSecret!!")).email).toBe("a@example.com");
    const wrongPw = await authenticate("a@example.com", "nope").catch((e) => e);
    const noUser = await authenticate("ghost@example.com", "whatever").catch((e) => e);
    expect(wrongPw.message).toBe(noUser.message);
    expect(wrongPw.status).toBe(401);
  });

  it("blocks disabled accounts", async () => {
    const u = await makeUser();
    await db.user.update({ where: { id: u.id }, data: { disabledAt: new Date() } });
    await expect(authenticate(u.email, "Passw0rd!x1")).rejects.toMatchObject({ status: 401 });
  });

  it("verifies email with a single-use, expiring token", async () => {
    const u = await registerUser({ name: "A", email: "v@example.com", password: "Sup3rSecret!!" });
    const t = await db.authToken.findFirstOrThrow({ where: { userId: u.id, type: "VERIFY_EMAIL" } });
    expect(t.tokenHash).toHaveLength(64); // only the hash is stored
    await expect(verifyEmailToken("not-a-real-token")).rejects.toThrow();
    // Re-issue a token we know the plaintext for
    await db.authToken.update({ where: { id: t.id }, data: { tokenHash: sha256("known-token") } });
    await verifyEmailToken("known-token");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).emailVerifiedAt).not.toBeNull();
    await expect(verifyEmailToken("known-token")).rejects.toThrow(); // single use
    await db.authToken.create({ data: { userId: u.id, type: "VERIFY_EMAIL", tokenHash: sha256("old"), expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyEmailToken("old")).rejects.toThrow(); // expired
  });

  it("password reset: silent for unknown emails, single-use token, signs out all sessions", async () => {
    const u = await makeUser("customer", "reset@example.com");
    await db.session.create({ data: { tokenHash: "s1", userId: u.id, expiresAt: new Date(Date.now() + 1e6) } });
    await expect(requestPasswordReset("nobody@example.com")).resolves.toBeUndefined();
    await requestPasswordReset("reset@example.com");
    const tok = await db.authToken.findFirstOrThrow({ where: { userId: u.id, type: "RESET_PASSWORD" } });
    await db.authToken.update({ where: { id: tok.id }, data: { tokenHash: sha256("reset-token") } });
    await resetPassword("reset-token", "BrandNew#Pass99");
    await expect(authenticate("reset@example.com", "Passw0rd!x1")).rejects.toThrow();
    expect((await authenticate("reset@example.com", "BrandNew#Pass99")).id).toBe(u.id);
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    await expect(resetPassword("reset-token", "AnotherOne#123")).rejects.toThrow();
  });

  it("change password requires the current password and keeps only the current session", async () => {
    const u = await makeUser();
    await db.session.createMany({ data: [{ tokenHash: "keep", userId: u.id, expiresAt: new Date(Date.now() + 1e6) }, { tokenHash: "drop", userId: u.id, expiresAt: new Date(Date.now() + 1e6) }] });
    await expect(changePassword(u.id, "wrong", "NewPassw0rd!!")).rejects.toThrow(/incorrect/);
    await changePassword(u.id, "Passw0rd!x1", "NewPassw0rd!!", "keep");
    expect((await db.session.findMany({ where: { userId: u.id } })).map((s) => s.tokenHash)).toEqual(["keep"]);
  });
});
