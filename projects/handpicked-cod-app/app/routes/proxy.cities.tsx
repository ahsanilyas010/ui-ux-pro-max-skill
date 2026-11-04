import type { LoaderFunctionArgs } from "react-router";
import { json, errorResponse } from "../lib/cod/errors";
import { proxyContext } from "../lib/cod/proxy.server";
import { CITY_LIST } from "../lib/cod/cities";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await proxyContext(request);
    return json(
      { ok: true, cities: [...CITY_LIST.map((c) => c.name), "Other"] },
      { headers: { "Cache-Control": "public, max-age=86400" } },
    );
  } catch (err) {
    if (err instanceof Response) throw err;
    return errorResponse(err);
  }
};
