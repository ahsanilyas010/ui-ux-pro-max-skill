import { authenticate } from "../../shopify.server";
import { CodError } from "./errors";
import type { AdminLike } from "./variants";

export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "unknown";
}

/**
 * Verifies the app proxy HMAC signature (authenticate.public.appProxy) and returns the shop + admin client.
 * ALLOWED_SHOP (optional) pins the app to a single store.
 */
export async function proxyContext(request: Request): Promise<{ shop: string; admin: AdminLike }> {
  const ctx = await authenticate.public.appProxy(request);
  const { session, admin } = ctx;
  if (!session || !admin) {
    throw new CodError("forbidden", 403, "App is not installed on this shop.");
  }
  const allowed = process.env.ALLOWED_SHOP;
  if (allowed && session.shop !== allowed) {
    throw new CodError("forbidden", 403, "Shop not allowed.");
  }
  return { shop: session.shop, admin: admin as unknown as AdminLike };
}
