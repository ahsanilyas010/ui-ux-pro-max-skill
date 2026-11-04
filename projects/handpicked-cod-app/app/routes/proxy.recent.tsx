import type { LoaderFunctionArgs } from "react-router";
import db from "../db.server";
import { json, errorResponse } from "../lib/cod/errors";
import { proxyContext } from "../lib/cod/proxy.server";

/**
 * Anonymised social-proof feed. Exposes first name and city ONLY (no phone, address, surname, order id).
 * Orders flagged needs-confirmation are excluded so junk orders never show up as proof.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    const { shop } = await proxyContext(request);
    const rows = await db.codOrder.findMany({
      where: { shop, status: "created", NOT: { riskTags: { contains: "needs-confirmation" } }, cityVerified: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { firstName: true, city: true, productTitle: true, createdAt: true },
    });
    const now = Date.now();
    const items = rows.map((r) => ({
      firstName: r.firstName,
      city: r.city,
      product: r.productTitle,
      minutesAgo: Math.max(1, Math.round((now - r.createdAt.getTime()) / 60000)),
    }));
    return json(items, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (err) {
    if (err instanceof Response) throw err;
    return errorResponse(err);
  }
};
