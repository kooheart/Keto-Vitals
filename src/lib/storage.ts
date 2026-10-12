import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { badRequest } from "./errors";

const MAX_BYTES = 5 * 1024 * 1024;
// Validate by magic bytes, not by the (spoofable) filename or Content-Type.
const SIGNATURES: Array<{ ext: string; mime: string; test: (b: Buffer) => boolean }> = [
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "webp", mime: "image/webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
];

export function detectImage(buf: Buffer) {
  return SIGNATURES.find((s) => s.test(buf));
}

/** Validates and stores an uploaded image; returns its public URL. Driver chosen by STORAGE_DRIVER. */
export async function storeImage(file: File): Promise<string> {
  if (file.size === 0) throw badRequest("The file is empty.");
  if (file.size > MAX_BYTES) throw badRequest("Images must be 5 MB or smaller.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = detectImage(buf);
  if (!kind) throw badRequest("Only JPEG, PNG or WebP images are allowed.");
  const name = `${crypto.randomUUID()}.${kind.ext}`;

  if (process.env.STORAGE_DRIVER === "cloudinary") return uploadToCloudinary(buf, kind.mime, name);

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return `/uploads/${name}`;
}

/** Signed upload via Cloudinary's REST API. Requires CLOUDINARY_* env vars. */
async function uploadToCloudinary(buf: Buffer, mime: string, name: string): Promise<string> {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error("Cloudinary credentials are not configured");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "keto-vitals";
  const signature = crypto.createHash("sha1").update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest("hex");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(buf)], { type: mime }), name);
  form.set("api_key", key);
  form.set("timestamp", timestamp);
  form.set("folder", folder);
  form.set("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Cloudinary upload failed (${res.status})`);
  return ((await res.json()) as { secure_url: string }).secure_url;
}
