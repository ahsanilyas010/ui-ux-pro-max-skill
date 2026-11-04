import type { ActionFunctionArgs } from "react-router";
import { json, errorResponse } from "../lib/cod/errors";
import { proxyContext } from "../lib/cod/proxy.server";
import { quoteSchema } from "../lib/cod/schema";
import { fetchVariants, validateLines, subtotalOf } from "../lib/cod/variants";
import { computeTotals } from "../lib/cod/shipping";
import { getSettings } from "../lib/cod/settings";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") return json({ ok: false }, { status: 405 });
  try {
    const { shop, admin } = await proxyContext(request);
    const body = quoteSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return json({ ok: false, code: "validation" }, { status: 422 });
    const lines = body.data.lines;
    const variants = await fetchVariants(admin, lines.map((l) => l.variantId));
    const problems = validateLines(lines, variants);
    if (problems.length) return json({ ok: false, code: "sold_out", variants: problems }, { status: 410 });
    const settings = await getSettings(shop);
    return json({ ok: true, ...computeTotals(subtotalOf(lines, variants), settings), eta: settings.etaText });
  } catch (err) {
    if (err instanceof Response) throw err;
    return errorResponse(err);
  }
};
