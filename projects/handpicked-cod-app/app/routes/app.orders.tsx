import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { normalisePkMobile } from "../lib/cod/phone";
import { maskPhone } from "../lib/cod/logger";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [orders, blocks] = await Promise.all([
    db.codOrder.findMany({ where: { shop: session.shop }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.phoneBlock.findMany({ orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderName: o.orderName || "(pending)",
      phone: maskPhone(o.phone),
      city: o.city,
      total: o.total / 100,
      status: o.status,
      riskTags: o.riskTags,
      createdAt: o.createdAt.toISOString(),
    })),
    blocks: blocks.map((b) => ({ phone: b.phone, reason: b.reason, refusals: b.refusals, blocked: b.blocked })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "block") {
    const phone = normalisePkMobile(form.get("phone"));
    if (!phone) return { error: "Enter a valid mobile number" };
    await db.phoneBlock.upsert({
      where: { phone },
      create: { phone, blocked: true, reason: String(form.get("reason") || "manual").slice(0, 200) },
      update: { blocked: true, reason: String(form.get("reason") || "manual").slice(0, 200) },
    });
  } else if (intent === "unblock") {
    const phone = String(form.get("phone") || "");
    await db.phoneBlock.deleteMany({ where: { phone } });
  }
  return { ok: true };
};

export default function Orders() {
  const { orders, blocks } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  return (
    <s-page heading="COD orders">
      <s-section heading="Latest 100 quick orders">
        <s-table>
          <s-table-header-row>
            <s-table-header>Order</s-table-header>
            <s-table-header>Phone</s-table-header>
            <s-table-header>City</s-table-header>
            <s-table-header>Total (PKR)</s-table-header>
            <s-table-header>Status</s-table-header>
            <s-table-header>Risk</s-table-header>
            <s-table-header>Created</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {orders.map((o) => (
              <s-table-row key={o.id}>
                <s-table-cell>{o.orderName}</s-table-cell>
                <s-table-cell>{o.phone}</s-table-cell>
                <s-table-cell>{o.city}</s-table-cell>
                <s-table-cell>{o.total.toLocaleString("en-PK")}</s-table-cell>
                <s-table-cell>{o.status}</s-table-cell>
                <s-table-cell>{o.riskTags.replace(/risk:/g, "")}</s-table-cell>
                <s-table-cell>{new Date(o.createdAt).toLocaleString("en-PK")}</s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section heading="Blocked phone numbers">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="block" />
          <s-stack gap="base" direction="inline">
            <s-text-field name="phone" label="Phone" placeholder="03XX XXXXXXX" />
            <s-text-field name="reason" label="Reason" />
            <s-button type="submit">Block</s-button>
          </s-stack>
        </fetcher.Form>
        {fetcher.data && "error" in fetcher.data && <s-banner tone="critical">{fetcher.data.error}</s-banner>}
        <s-table>
          <s-table-header-row>
            <s-table-header>Phone</s-table-header>
            <s-table-header>Reason</s-table-header>
            <s-table-header>Refusals</s-table-header>
            <s-table-header>State</s-table-header>
            <s-table-header>Action</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {blocks.map((b) => (
              <s-table-row key={b.phone}>
                <s-table-cell>{b.phone}</s-table-cell>
                <s-table-cell>{b.reason}</s-table-cell>
                <s-table-cell>{b.refusals}</s-table-cell>
                <s-table-cell>{b.blocked ? "Blocked" : "Watching"}</s-table-cell>
                <s-table-cell>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="unblock" />
                    <input type="hidden" name="phone" value={b.phone} />
                    <s-button type="submit" variant="tertiary">Remove</s-button>
                  </fetcher.Form>
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
