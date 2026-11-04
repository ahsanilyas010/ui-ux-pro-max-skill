import db from "../../db.server";
import type { Setting } from "@prisma/client";

export type CodSettings = Setting;

function envInt(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Settings row for the shop, created on first use. Env vars seed the first row only. */
export async function getSettings(shop: string): Promise<CodSettings> {
  const existing = await db.setting.findUnique({ where: { shop } });
  if (existing) return existing;
  return db.setting.create({
    data: {
      shop,
      freeThreshold: envInt("COD_FREE_SHIPPING_THRESHOLD") ?? 300000,
      flatRate: envInt("COD_FLAT_RATE") ?? 25000,
      etaText: process.env.COD_ETA_TEXT || "2-4 working days via PostEx",
      paymentTermsTemplateId: process.env.COD_PAYMENT_TERMS_TEMPLATE_ID || null,
      paymentGatewayId: process.env.COD_PAYMENT_GATEWAY_ID || null,
      testMode: process.env.COD_TEST_MODE === "true",
      whatsappWebhookUrl: process.env.WHATSAPP_WEBHOOK_URL || null,
      useDraftOrder: process.env.USE_ORDER_CREATE === "false",
    },
  });
}

export function parseBlockedCities(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map((x) => String(x).toLowerCase()) : [];
  } catch {
    return [];
  }
}
