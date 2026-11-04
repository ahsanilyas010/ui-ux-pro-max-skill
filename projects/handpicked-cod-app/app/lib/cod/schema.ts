import { z } from "zod";
import { normalisePkMobile } from "./phone";

const idLike = z
  .union([z.number().int().positive(), z.string().regex(/^(gid:\/\/shopify\/ProductVariant\/)?\d+$/)])
  .transform((v) => String(v).replace("gid://shopify/ProductVariant/", ""));

export const lineSchema = z.object({
  variantId: idLike,
  quantity: z.number().int().min(1).max(50),
});

const utmSchema = z
  .object({
    source: z.string().max(100).optional().default(""),
    medium: z.string().max(100).optional().default(""),
    campaign: z.string().max(200).optional().default(""),
  })
  .partial()
  .optional();

export const quoteSchema = z.object({
  lines: z.array(lineSchema).min(1).max(20),
});

export const orderSchema = z.object({
  lines: z.array(lineSchema).min(1, "Add at least one item").max(20),
  name: z.string().trim().min(2, "Enter your full name").max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => normalisePkMobile(v) !== null, "Enter a valid mobile number like 0300 1234567"),
  city: z.string().trim().min(2, "Enter your city").max(60),
  address: z.string().trim().min(10, "Enter your full address (house, street, area)").max(300),
  note: z.string().trim().max(300).optional().default(""),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .default("")
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email or leave blank"),
  source: z.enum(["pdp", "drawer", "cart"]).catch("pdp"),
  website: z.string().max(200).optional().default(""),
  renderedAt: z.number().optional(),
  cartToken: z.string().max(100).optional().default(""),
  utm: utmSchema,
});

export type OrderInput = z.infer<typeof orderSchema>;

/** Flatten zod issues to { field: message } as the theme expects (first message per field). */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] === "lines" ? "lines" : String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
