import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { normalisePkMobile } from "../lib/cod/phone";
import { logger, maskPhone } from "../lib/cod/logger";

const REFUSAL_REASONS = new Set(["customer", "declined", "fraud", "other"]);
const AUTO_BLOCK_AT = 2;

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const p = payload as { id?: number; tags?: string; cancel_reason?: string | null; phone?: string | null; shipping_address?: { phone?: string | null } };
  if (!p.id) return new Response();
  const gid = `gid://shopify/Order/${p.id}`;

  const row = await db.codOrder.findFirst({ where: { shop, orderId: gid } });
  if (!row) return new Response(); // not one of ours
  if (row.status === "cancelled") return new Response(); // webhook retry

  await db.codOrder.update({ where: { id: row.id }, data: { status: "cancelled" } });

  const tagged = (p.tags || "").split(",").map((t) => t.trim()).includes("COD");
  const phone = row.phone || normalisePkMobile(p.phone || p.shipping_address?.phone);
  const refusal = tagged && REFUSAL_REASONS.has(p.cancel_reason || "other");
  if (phone && refusal) {
    // Cancelled COD orders with a junk city seed the blocklist faster (counts double).
    const bump = row.riskTags.includes("risk:junk-city") ? 2 : 1;
    const existing = await db.phoneBlock.findUnique({ where: { phone } });
    const refusals = (existing?.refusals ?? 0) + bump;
    await db.phoneBlock.upsert({
      where: { phone },
      create: { phone, refusals, blocked: refusals >= AUTO_BLOCK_AT, reason: `cancelled ${topic}: ${p.cancel_reason ?? "unknown"}` },
      update: { refusals, blocked: existing?.blocked || refusals >= AUTO_BLOCK_AT },
    });
    logger.info("phone refusal recorded", { phone: maskPhone(phone), refusals });
  }
  return new Response();
};
