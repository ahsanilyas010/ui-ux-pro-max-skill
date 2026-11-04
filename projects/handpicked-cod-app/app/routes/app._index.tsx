import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getSettings } from "../lib/cod/settings";

const toInt = (v: FormDataEntryValue | null, fallback: number) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
/** PKR (decimal text) to paisa. */
const pkrToPaisa = (v: FormDataEntryValue | null, fallback: number) => {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : fallback;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const s = await getSettings(session.shop);
  return {
    settings: {
      enabled: s.enabled,
      freeThresholdPkr: s.freeThreshold / 100,
      flatRatePkr: s.flatRate / 100,
      etaText: s.etaText,
      paymentTermsTemplateId: s.paymentTermsTemplateId ?? "",
      paymentGatewayId: s.paymentGatewayId ?? "",
      maxQty: s.maxQty,
      maxSubtotalPkr: s.maxSubtotal / 100,
      highValueCapPkr: s.highValueCap / 100,
      useDraftOrder: s.useDraftOrder,
      testMode: s.testMode,
      whatsappNumber: s.whatsappNumber ?? "",
      whatsappWebhookUrl: s.whatsappWebhookUrl ?? "",
      advanceInstructions: s.advanceInstructions ?? "",
      blockedCities: (JSON.parse(s.blockedCitiesJson || "[]") as string[]).join(", "),
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") || "save");

  if (intent === "lookup") {
    const res = await admin.graphql(`#graphql
      query CodPaymentTerms {
        paymentTermsTemplates { id name paymentTermsType dueInDays }
      }`);
    const body = await res.json();
    return { intent, templates: (body.data?.paymentTermsTemplates ?? []) as Array<{ id: string; name: string; paymentTermsType: string; dueInDays: number | null }> };
  }

  const prev = await getSettings(session.shop);
  const blocked = String(form.get("blockedCities") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  await db.setting.update({
    where: { shop: session.shop },
    data: {
      enabled: form.get("enabled") === "on",
      freeThreshold: pkrToPaisa(form.get("freeThresholdPkr"), prev.freeThreshold),
      flatRate: pkrToPaisa(form.get("flatRatePkr"), prev.flatRate),
      etaText: String(form.get("etaText") || prev.etaText).slice(0, 120),
      paymentTermsTemplateId: String(form.get("paymentTermsTemplateId") || "") || null,
      paymentGatewayId: String(form.get("paymentGatewayId") || "") || null,
      maxQty: Math.max(1, toInt(form.get("maxQty"), prev.maxQty)),
      maxSubtotal: pkrToPaisa(form.get("maxSubtotalPkr"), prev.maxSubtotal),
      highValueCap: pkrToPaisa(form.get("highValueCapPkr"), prev.highValueCap),
      useDraftOrder: form.get("useDraftOrder") === "on",
      testMode: form.get("testMode") === "on",
      whatsappNumber: String(form.get("whatsappNumber") || "") || null,
      whatsappWebhookUrl: String(form.get("whatsappWebhookUrl") || "") || null,
      advanceInstructions: String(form.get("advanceInstructions") || "") || null,
      blockedCitiesJson: JSON.stringify(blocked),
    },
  });
  return { intent: "save", saved: true };
};

export default function Settings() {
  const { settings: s } = useLoaderData<typeof loader>();
  const saveFetcher = useFetcher<typeof action>();
  const lookupFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (saveFetcher.data && "saved" in saveFetcher.data && saveFetcher.data.saved) shopify.toast.show("Settings saved");
  }, [saveFetcher.data, shopify]);

  const templates = lookupFetcher.data && "templates" in lookupFetcher.data ? lookupFetcher.data.templates : null;

  return (
    <s-page heading="HandPicked COD Quick Order">
      <saveFetcher.Form method="post" data-save-bar>
        <input type="hidden" name="intent" value="save" />
        <s-section heading="General">
          <s-stack gap="base">
            <s-switch name="enabled" label="Accept quick orders" defaultChecked={s.enabled} />
            <s-switch name="testMode" label="Test mode (orders are created with test=true)" defaultChecked={s.testMode} />
            <s-text-field name="whatsappNumber" label="WhatsApp number (digits, e.g. 923422221633)" defaultValue={s.whatsappNumber} />
            <s-text-field name="etaText" label="Delivery ETA text" defaultValue={s.etaText} />
          </s-stack>
        </s-section>

        <s-section heading="Delivery pricing (PKR)">
          <s-stack gap="base">
            <s-text-field name="freeThresholdPkr" label="Free delivery from (PKR)" defaultValue={String(s.freeThresholdPkr)} />
            <s-text-field name="flatRatePkr" label="Flat delivery fee (PKR)" defaultValue={String(s.flatRatePkr)} />
            <s-paragraph>Keep these equal to the theme settings and your Shopify shipping rates, otherwise the totals shown to customers will disagree.</s-paragraph>
          </s-stack>
        </s-section>

        <s-section heading="Limits and risk">
          <s-stack gap="base">
            <s-text-field name="maxQty" label="Max items per order" defaultValue={String(s.maxQty)} />
            <s-text-field name="maxSubtotalPkr" label="Hard cap per order (PKR)" defaultValue={String(s.maxSubtotalPkr)} />
            <s-text-field name="highValueCapPkr" label="High-value cap for new phone numbers (PKR)" defaultValue={String(s.highValueCapPkr)} />
            <s-paragraph>
              New phone numbers above the high-value cap are created tagged needs-confirmation and the storefront asks for a small advance
              (status advance_required).
            </s-paragraph>
            <s-text-field name="advanceInstructions" label="Advance payment instructions (shown to customer)" defaultValue={s.advanceInstructions} />
            <s-text-field name="blockedCities" label="Blocked cities (comma separated)" defaultValue={s.blockedCities} />
          </s-stack>
        </s-section>

        <s-section heading="Order creation">
          <s-stack gap="base">
            <s-paragraph>
              Default: orderCreate with a pending Cash on Delivery transaction. Turn on the draft order path only if orderCreate is
              unavailable for your store.
            </s-paragraph>
            <s-switch name="useDraftOrder" label="Use draft order path instead of orderCreate" defaultChecked={s.useDraftOrder} />
            <s-text-field name="paymentTermsTemplateId" label="Payment terms template ID (draft path)" defaultValue={s.paymentTermsTemplateId} />
            <s-text-field name="paymentGatewayId" label="Payment gateway ID (draft path, optional)" defaultValue={s.paymentGatewayId} />
          </s-stack>
        </s-section>

        <s-section heading="Notifications">
          <s-text-field name="whatsappWebhookUrl" label="Order webhook URL (HMAC-signed POST)" defaultValue={s.whatsappWebhookUrl} />
        </s-section>

        <s-section>
          <s-button type="submit" variant="primary" loading={saveFetcher.state !== "idle" || undefined}>
            Save settings
          </s-button>
        </s-section>
      </saveFetcher.Form>

      <s-section heading="Find payment terms templates">
        <lookupFetcher.Form method="post">
          <input type="hidden" name="intent" value="lookup" />
          <s-button type="submit" loading={lookupFetcher.state !== "idle" || undefined}>
            List templates
          </s-button>
        </lookupFetcher.Form>
        {templates && (
          <s-unordered-list>
            {templates.map((t) => (
              <s-list-item key={t.id}>
                {t.name} ({t.paymentTermsType}
                {t.dueInDays != null ? `, ${t.dueInDays} days` : ""}): <code>{t.id}</code>
              </s-list-item>
            ))}
          </s-unordered-list>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
