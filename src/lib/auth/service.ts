import { db } from "../db";
import { AppError, badRequest, conflict } from "../errors";
import { sendEmail } from "../email";
import { DUMMY_HASH, hashPassword, randomToken, sha256, verifyPassword } from "./password";

const EMAIL_VERIFY_HOURS = 48;
const RESET_MINUTES = 60;

export async function registerUser(input: { name: string; email: string; password: string; phone?: string }) {
  const email = input.email.toLowerCase();
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) throw conflict("An account with this email already exists.", "email_taken");
  const role = await db.role.findUnique({ where: { name: "customer" } });
  if (!role) throw new AppError(500, "Roles are not seeded. Run `npm run db:seed`.");
  const user = await db.user.create({
    data: { email, name: input.name.trim(), phone: input.phone, passwordHash: await hashPassword(input.password), roleId: role.id },
  });
  await sendVerificationEmail(user.id, user.email, user.name).catch((e) => console.error("verify email failed", e.message));
  return user;
}

export async function authenticate(emailRaw: string, password: string) {
  const user = await db.user.findUnique({ where: { email: emailRaw.toLowerCase() } });
  // Always run a hash comparison so timing doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || user.disabledAt) throw new AppError(401, "Incorrect email or password.", "invalid_credentials");
  return user;
}

async function issueToken(userId: string, type: "VERIFY_EMAIL" | "RESET_PASSWORD", ttlMs: number) {
  const token = randomToken();
  await db.authToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.authToken.create({ data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

export async function sendVerificationEmail(userId: string, email: string, name: string) {
  const token = await issueToken(userId, "VERIFY_EMAIL", EMAIL_VERIFY_HOURS * 36e5);
  const url = `${process.env.APP_URL}/verify-email?token=${token}`;
  await sendEmail({ to: email, subject: "Verify your Keto Vitals email", text: `Hi ${name},\n\nConfirm your email address: ${url}\n\nThis link expires in ${EMAIL_VERIFY_HOURS} hours.` });
}

export async function verifyEmailToken(token: string) {
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "VERIFY_EMAIL" || t.usedAt || t.expiresAt < new Date()) throw badRequest("This verification link is invalid or has expired.");
  await db.$transaction([
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: t.userId }, data: { emailVerifiedAt: new Date() } }),
  ]);
}

/** Always resolves, so callers can't probe which emails are registered. */
export async function requestPasswordReset(emailRaw: string) {
  const user = await db.user.findUnique({ where: { email: emailRaw.toLowerCase() } });
  if (!user || user.disabledAt) return;
  const token = await issueToken(user.id, "RESET_PASSWORD", RESET_MINUTES * 6e4);
  const url = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({ to: user.email, subject: "Reset your Keto Vitals password", text: `Hi ${user.name},\n\nReset your password: ${url}\n\nThis link expires in ${RESET_MINUTES} minutes. If you did not request it, ignore this email.` });
}

export async function resetPassword(token: string, newPassword: string) {
  const t = await db.authToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!t || t.type !== "RESET_PASSWORD" || t.usedAt || t.expiresAt < new Date()) throw badRequest("This reset link is invalid or has expired.");
  await db.$transaction([
    db.authToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(newPassword) } }),
    // Sign out everywhere after a password reset.
    db.session.deleteMany({ where: { userId: t.userId } }),
  ]);
}

export async function changePassword(userId: string, current: string, next: string, keepSessionHash?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw badRequest("Your current password is incorrect.", "wrong_password");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await db.session.deleteMany({ where: { userId, ...(keepSessionHash ? { tokenHash: { not: keepSessionHash } } : {}) } });
}
