import { createHmac } from "node:crypto";
import { logger } from "./logger";

export function whatsappLink(number: string | null | undefined, orderName: string, total: number): string | null {
  const n = (number || "").replace(/[^\d]/g, "");
  if (!n) return null;
  const text = `Hi HandPicked, please confirm my order ${orderName} (Rs. ${Math.round(total / 100).toLocaleString("en-PK")}).`;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

/** Fire-and-forget order notification with HMAC-SHA256 signature in X-HandPicked-Signature. */
export function notifyWebhook(url: string | null | undefined, payload: Record<string, unknown>): void {
  if (!url) return;
  const body = JSON.stringify(payload);
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET || "";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-HandPicked-Signature": `sha256=${signature}` },
    body,
    signal: AbortSignal.timeout(5000),
  }).catch((e) => logger.warn("whatsapp webhook failed", { error: String(e) }));
}
