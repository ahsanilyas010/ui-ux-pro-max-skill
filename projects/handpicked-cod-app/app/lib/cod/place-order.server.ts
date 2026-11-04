import db from "../../db.server";
import { CodError } from "./errors";
import { orderSchema, fieldErrors, type OrderInput } from "./schema";
import { normalisePkMobile } from "./phone";
import { matchCity } from "./cities";
import { computeTotals } from "./shipping";
import { dedupeHash, isWithinWindow, saltedHash } from "./dedupe";
import { checkRate, cleanupRateHits, IP_RULE, PHONE_RULE } from "./rate-limit";
import { fetchVariants, validateLines, subtotalOf } from "./variants";
import type { AdminLike } from "./variants";
import { assessRisk } from "./risk";
import { createOrder } from "./order";
import { getSettings, parseBlockedCities } from "./settings";
import { notifyWebhook, whatsappLink } from "./whatsapp";
import { logger, maskPhone } from "./logger";

export type OrderStatus = "created" | "needs_confirmation" | "advance_required";

export interface PlaceOrderResult {
  httpStatus: number;
  body: Record<string, unknown>;
}

const MIN_RENDER_MS = 3000;

function mergeLines(lines: OrderInput["lines"]) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.variantId, (m.get(l.variantId) ?? 0) + l.quantity);
  return [...m.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
}

function successBody(
  o: { orderName: string; orderId: string; subtotal: number; shipping: number; total: number; riskTags: string },
  status: OrderStatus,
  s: Awaited<ReturnType<typeof getSettings>>,
) {
  const wa = whatsappLink(s.whatsappNumber || process.env.WHATSAPP_NUMBER, o.orderName, o.total);
  return {
    ok: true,
    status,
    orderName: o.orderName,
    orderId: o.orderId,
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    eta: s.etaText,
    whatsapp: wa,
    test: s.testMode,
    ...(status === "advance_required"
      ? {
          advance: {
            required: true,
            instructions:
              s.advanceInstructions ||
              "For first orders above this value we ask for a small advance via Easypaisa, JazzCash or Raast. Send a screenshot on WhatsApp and we will dispatch right away.",
          },
        }
      : {}),
  };
}

function statusFromTags(tags: string): OrderStatus {
  if (tags.includes("advance-required")) return "advance_required";
  if (tags.includes("needs-confirmation")) return "needs_confirmation";
  return "created";
}

export async function placeOrder(args: { shop: string; admin: AdminLike; ip: string; raw: unknown; now?: number }): Promise<PlaceOrderResult> {
  const { shop, admin, ip, raw } = args;
  const now = args.now ?? Date.now();

  if (typeof raw !== "object" || raw === null) throw new CodError("bad_request", 400, "Invalid request body.");

  // Honeypot: pretend success, create nothing.
  const hp = (raw as Record<string, unknown>).website;
  if (typeof hp === "string" && hp.trim() !== "") {
    return { httpStatus: 200, body: { ok: true, status: "created", orderName: "#PENDING" } };
  }

  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { httpStatus: 422, body: { ok: false, code: "validation", errors: fieldErrors(parsed.error) } };
  }
  const input = parsed.data;

  if (typeof input.renderedAt !== "number" || now - input.renderedAt < MIN_RENDER_MS) {
    return { httpStatus: 422, body: { ok: false, code: "validation", errors: { form: "Please check your details and try again." } } };
  }

  const settings = await getSettings(shop);
  if (!settings.enabled) throw new CodError("disabled", 503, "Quick order is unavailable right now. Please use checkout.");

  const phone = normalisePkMobile(input.phone)!;
  const lines = mergeLines(input.lines);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  if (totalQty > settings.maxQty) {
    return { httpStatus: 422, body: { ok: false, code: "validation", errors: { lines: `You can order up to ${settings.maxQty} items at once.` } } };
  }

  const city = matchCity(input.city);
  if (parseBlockedCities(settings.blockedCitiesJson).includes(city.city.toLowerCase())) {
    return { httpStatus: 422, body: { ok: false, code: "validation", errors: { city: "Sorry, we cannot deliver to this city yet." } } };
  }

  const block = await db.phoneBlock.findUnique({ where: { phone } });
  if (block?.blocked) {
    return { httpStatus: 422, body: { ok: false, code: "blocked", errors: { phone: "We can't take Cash on Delivery on this number. Please use checkout." } } };
  }

  // Dedupe (idempotent double tap / retry).
  const hash = dedupeHash(shop, phone, lines);
  const existing = await db.codOrder.findUnique({ where: { dedupeHash: hash } });
  if (existing) {
    if (isWithinWindow(existing.createdAt, now)) {
      if (existing.status === "created") {
        return { httpStatus: 200, body: { ...successBody(existing, statusFromTags(existing.riskTags), settings), deduped: true } };
      }
      if (existing.status === "creating") throw new CodError("bad_request", 409, "Your order is being placed. Please wait a moment.");
    }
    // Outside the window (or failed/cancelled): free the hash so the same basket can be ordered again.
    await db.codOrder.update({ where: { id: existing.id }, data: { dedupeHash: saltedHash(hash, existing.createdAt.getTime()) } });
  }

  // Rate limits.
  const ipWait = await checkRate(db, IP_RULE(ip), now);
  const phoneWait = ipWait === null ? await checkRate(db, PHONE_RULE(phone), now) : null;
  const wait = ipWait ?? phoneWait;
  if (wait !== null) throw new CodError("rate_limited", 429, "Too many attempts. Please try again later.", { retryAfter: wait });
  if (Math.random() < 0.02) void cleanupRateHits(db).catch(() => undefined);

  // Variants.
  const variants = await fetchVariants(admin, lines.map((l) => l.variantId));
  const problems = validateLines(lines, variants);
  if (problems.length) {
    return { httpStatus: 410, body: { ok: false, code: "sold_out", message: "Some items are no longer available.", variants: problems } };
  }

  const subtotal = subtotalOf(lines, variants);
  if (subtotal > settings.maxSubtotal) {
    return { httpStatus: 422, body: { ok: false, code: "validation", errors: { lines: "This order is too large for Cash on Delivery. Please use checkout." } } };
  }
  const totals = computeTotals(subtotal, settings);

  // Risk.
  const priorOrders = await db.codOrder.count({ where: { shop, phone, status: "created" } });
  const since = new Date(now - 24 * 3600 * 1000);
  let variantOrders24h = 0;
  for (const l of lines) {
    const n = await db.codOrder.count({ where: { shop, status: "created", createdAt: { gte: since }, variantIds: { contains: `,${l.variantId},` } } });
    variantOrders24h = Math.max(variantOrders24h, n);
  }
  const risk = assessRisk({
    isNewPhone: priorOrders === 0,
    cityVerified: city.verified,
    rawCity: input.city,
    subtotal,
    maxSubtotal: settings.maxSubtotal,
    highValueCap: settings.highValueCap,
    refusals: block?.refusals ?? 0,
    variantOrders24h,
  });

  // Claim the dedupe hash BEFORE creating the Shopify order so concurrent requests cannot double-create.
  const first = [...variants.values()][0];
  const claim = await db.codOrder
    .create({
      data: {
        shop,
        orderId: "",
        orderName: "",
        firstName: input.name.trim().split(/\s+/)[0].slice(0, 30),
        productTitle: first?.product.title ?? "",
        phone,
        city: city.city,
        cityVerified: city.verified,
        dedupeHash: hash,
        ip,
        source: input.source,
        variantIds: `,${lines.map((l) => l.variantId).join(",")},`,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        total: totals.total,
        status: "creating",
        riskTags: risk.tags.join(","),
      },
    })
    .catch((e: { code?: string }) => {
      if (e.code === "P2002") throw new CodError("bad_request", 409, "Your order is being placed. Please wait a moment.");
      throw e;
    });

  const tags = ["COD", "quick-order", `src:${input.source}`, `city:${city.city}`, ...risk.tags];
  const utm = input.utm ?? {};
  try {
    const useDraft = settings.useDraftOrder || process.env.USE_ORDER_CREATE === "false";
    const created = await createOrder(admin, {
      path: useDraft ? "draft_order" : "order_create",
      lines,
      name: input.name,
      phone,
      email: input.email,
      city: city.city,
      province: city.province,
      address: input.address,
      note: input.note,
      tags,
      attributes: {
        cod_dedupe: hash.slice(0, 16),
        cod_ip: ip,
        cod_source: input.source,
        cod_city_input: input.city,
        utm_source: utm.source ?? "",
        utm_medium: utm.medium ?? "",
        utm_campaign: utm.campaign ?? "",
      },
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total,
      idempotencyKey: hash,
      test: settings.testMode,
      paymentTermsTemplateId: settings.paymentTermsTemplateId,
      paymentGatewayId: settings.paymentGatewayId,
    });

    const saved = await db.codOrder.update({
      where: { id: claim.id },
      data: { orderId: created.orderId, orderName: created.orderName, status: "created" },
    });
    logger.info("cod order created", { order: created.orderName, phone: maskPhone(phone), tags: risk.tags, path: useDraft ? "draft" : "order_create" });

    const status: OrderStatus = risk.advanceRequired ? "advance_required" : risk.needsConfirmation ? "needs_confirmation" : "created";
    notifyWebhook(settings.whatsappWebhookUrl || process.env.WHATSAPP_WEBHOOK_URL, {
      event: "cod_order_created",
      orderName: created.orderName,
      status,
      total: totals.total,
      city: city.city,
      riskTags: risk.tags,
    });
    return { httpStatus: 200, body: successBody(saved, status, settings) };
  } catch (e) {
    await db.codOrder
      .update({ where: { id: claim.id }, data: { status: "failed", dedupeHash: saltedHash(hash, now) } })
      .catch(() => undefined);
    throw e;
  }
}
