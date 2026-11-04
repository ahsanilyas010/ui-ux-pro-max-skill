import type { LoaderFunctionArgs } from "react-router";
import { json } from "../lib/cod/errors";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.public.appProxy(request);
  return json({ ok: true });
};
