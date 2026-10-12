import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const COST = Number(process.env.BCRYPT_COST ?? 12);

export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

// Compared against when the user does not exist so response time doesn't leak account existence.
export const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", COST);

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");
