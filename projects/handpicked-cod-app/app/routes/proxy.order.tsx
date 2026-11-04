import type { ActionFunctionArgs } from "react-router";
import { errorResponse, json } from "../lib/cod/errors";
import { clientIp, proxyContext } from "../lib/cod/proxy.server";
import { placeOrder } from "../lib/cod/place-order.server";
import { logger } from "../lib/cod/logger";

// App proxy: /apps/cod/order -> https://APP_URL/proxy/order
export const loader = async () =>
  json({ ok: false, code: "bad_request", message: "POST only" }, { status: 405, headers: { Allow: "POST" } });

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ ok: false, code: "bad_request", message: "POST only" }, { status: 405, headers: { Allow: "POST" } });
  }
  try {
    const { shop, admin } = await proxyContext(request);
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ ok: false, code: "bad_request", message: "Invalid JSON" }, { status: 400 });
    }
    const result = await placeOrder({ shop, admin, ip: clientIp(request), raw });
    return json(result.body, { status: result.httpStatus });
  } catch (err) {
    if (err instanceof Response) throw err; // appProxy auth failures
    logger.error("proxy.order failed", { error: err instanceof Error ? err.message : String(err) });
    return errorResponse(err);
  }
};
