import { z } from "zod";
import { PIN_RE } from "./shipping";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });

export const addressSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter the address").max(150),
  line2: z.string().trim().max(150).optional().or(z.literal("").transform(() => undefined)),
  landmark: z.string().trim().max(100).optional().or(z.literal("").transform(() => undefined)),
  city: z.string().trim().min(2, "Enter the city").max(60),
  state: z.string().trim().min(2, "Select the state").max(60),
  pincode: z.string().trim().regex(PIN_RE, "Enter a valid 6-digit PIN code"),
  label: z.string().trim().max(30).optional().or(z.literal("").transform(() => undefined)),
  isDefault: z.boolean().optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const reviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(100).optional(),
  body: z.string().trim().min(10, "Tell us a little more (at least 10 characters)").max(2000),
});
