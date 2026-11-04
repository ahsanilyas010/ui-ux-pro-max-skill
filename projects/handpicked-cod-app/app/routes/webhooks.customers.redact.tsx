import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { normalisePkMobile } from "../lib/cod/phone";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);
  const p = payload as { orders_to_redact?: number[]; customer?: { phone?: string | null } };
  const gids = (p.orders_to_redact ?? []).map((id) => `gid://shopify/Order/${id}`);
  const phone = normalisePkMobile(p.customer?.phone);
  if (gids.length) {
    await db.codOrder.updateMany({
      where: { shop, orderId: { in: gids } },
      data: { phone: "redacted", firstName: "", ip: "", city: "", productTitle: "" },
    });
  }
  if (phone) await db.phoneBlock.deleteMany({ where: { phone } });
  return new Response();
};
