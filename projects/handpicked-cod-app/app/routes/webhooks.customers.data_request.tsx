import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { logger } from "../lib/cod/logger";

// We hold name-free order metadata: normalised phone, city, order id/name. There is no automated export;
// the merchant answers the request from Shopify admin. Acknowledge and log it.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  logger.info("compliance webhook received", { shop, topic });
  return new Response();
};
