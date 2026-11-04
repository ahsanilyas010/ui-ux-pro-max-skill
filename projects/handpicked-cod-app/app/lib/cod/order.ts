import { CodError } from "./errors";
import { paisaToDecimal } from "./shipping";
import { provinceCode, type Province } from "./cities";
import type { AdminLike } from "./variants";

export const SHIPPING_TITLE = "Standard Delivery (PostEx)";
export const GATEWAY_NAME = "Cash on Delivery (COD)";
const CURRENCY = "PKR";

export interface CreateOrderParams {
  path: "order_create" | "draft_order";
  lines: Array<{ variantId: string; quantity: number }>;
  name: string;
  phone: string; // +923XXXXXXXXX
  email: string;
  city: string;
  province: Province | null;
  address: string;
  note: string;
  tags: string[];
  attributes: Record<string, string>;
  subtotal: number; // paisa
  shipping: number; // paisa
  total: number; // paisa
  /** Idempotency key (orderCreate sourceIdentifier). */
  idempotencyKey: string;
  test: boolean;
  paymentTermsTemplateId?: string | null;
  paymentGatewayId?: string | null;
}

export interface CreatedOrder {
  orderId: string; // gid
  orderName: string;
  paymentGatewayNames: string[];
}

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts.shift() || full;
  return { firstName, lastName: parts.join(" ") };
}

const money = (paisa: number) => ({ amount: paisaToDecimal(paisa), currencyCode: CURRENCY });

export function buildOrderCreateInput(p: CreateOrderParams) {
  const { firstName, lastName } = splitName(p.name);
  const address = {
    firstName,
    lastName,
    address1: p.address,
    city: p.city,
    provinceCode: provinceCode(p.province),
    countryCode: "PK",
    phone: p.phone,
  };
  return {
    order: {
      currency: CURRENCY,
      presentmentCurrency: CURRENCY,
      financialStatus: "PENDING",
      lineItems: p.lines.map((l) => ({ variantId: `gid://shopify/ProductVariant/${l.variantId}`, quantity: l.quantity })),
      shippingLines: [
        {
          title: SHIPPING_TITLE,
          code: "postex-standard",
          source: "HandPicked COD",
          priceSet: { shopMoney: money(p.shipping) },
        },
      ],
      transactions: [
        {
          kind: "SALE",
          status: "PENDING",
          gateway: GATEWAY_NAME,
          amountSet: { shopMoney: money(p.total) },
          test: p.test,
        },
      ],
      shippingAddress: address,
      billingAddress: address,
      phone: p.phone,
      ...(p.email ? { email: p.email } : {}),
      note: p.note || undefined,
      tags: p.tags,
      customAttributes: Object.entries(p.attributes)
        .filter(([, v]) => v !== "")
        .map(([key, value]) => ({ key, value })),
      // sourceName intentionally omitted (a custom value breaks channel attribution); the idempotency key
      // lives in sourceIdentifier so a retried request can be matched to the order.
      sourceIdentifier: p.idempotencyKey,
      test: p.test,
    },
    options: {
      inventoryBehaviour: "DECREMENT_OBEYING_POLICY",
      sendReceipt: false,
      sendFulfillmentReceipt: false,
    },
  };
}

const ORDER_CREATE = `#graphql
  mutation CodOrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
    orderCreate(order: $order, options: $options) {
      order { id name paymentGatewayNames }
      userErrors { code field message }
    }
  }`;

const DRAFT_CREATE = `#graphql
  mutation CodDraftCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id }
      userErrors { field message }
    }
  }`;

const DRAFT_COMPLETE = `#graphql
  mutation CodDraftComplete($id: ID!, $paymentGatewayId: ID) {
    draftOrderComplete(id: $id, paymentGatewayId: $paymentGatewayId) {
      draftOrder { id order { id name paymentGatewayNames } }
      userErrors { field message }
    }
  }`;

const DRAFT_DELETE = `#graphql
  mutation CodDraftDelete($input: DraftOrderDeleteInput!) {
    draftOrderDelete(input: $input) { deletedId userErrors { message } }
  }`;

async function gql<T>(admin: AdminLike, query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await admin.graphql(query, { variables });
  const body = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (!body.data) {
    throw new CodError("internal", 502, "Shopify request failed", { shopifyErrors: body.errors?.map((e) => e.message) });
  }
  return body.data;
}

export async function createViaOrderCreate(admin: AdminLike, p: CreateOrderParams): Promise<CreatedOrder> {
  const data = await gql<{
    orderCreate: { order: { id: string; name: string; paymentGatewayNames: string[] } | null; userErrors: Array<{ code?: string; message: string }> };
  }>(admin, ORDER_CREATE, buildOrderCreateInput(p));
  const { order, userErrors } = data.orderCreate;
  if (userErrors.length || !order) {
    if (userErrors.some((e) => e.code === "INVENTORY_CLAIM_FAILED" || /inventory|stock/i.test(e.message))) {
      throw new CodError("sold_out", 409, "One of the items just sold out.");
    }
    throw new CodError("internal", 502, "Order could not be created", { shopifyErrors: userErrors.map((e) => e.message) });
  }
  return { orderId: order.id, orderName: order.name, paymentGatewayNames: order.paymentGatewayNames };
}

export function buildDraftInput(p: CreateOrderParams) {
  const { firstName, lastName } = splitName(p.name);
  const address = {
    firstName,
    lastName,
    address1: p.address,
    city: p.city,
    provinceCode: provinceCode(p.province),
    countryCode: "PK",
    phone: p.phone,
  };
  return {
    input: {
      presentmentCurrencyCode: CURRENCY,
      lineItems: p.lines.map((l) => ({ variantId: `gid://shopify/ProductVariant/${l.variantId}`, quantity: l.quantity })),
      shippingLine: { title: SHIPPING_TITLE, priceWithCurrency: money(p.shipping) },
      shippingAddress: address,
      billingAddress: address,
      phone: p.phone,
      ...(p.email ? { email: p.email } : {}),
      note: p.note || undefined,
      tags: p.tags,
      customAttributes: Object.entries(p.attributes)
        .filter(([, v]) => v !== "")
        .map(([key, value]) => ({ key, value })),
      ...(p.paymentTermsTemplateId ? { paymentTerms: { paymentTermsTemplateId: p.paymentTermsTemplateId } } : {}),
    },
  };
}

/** Fallback path, enabled via Setting.useDraftOrder or USE_ORDER_CREATE=false. */
export async function createViaDraftOrder(admin: AdminLike, p: CreateOrderParams): Promise<CreatedOrder> {
  const created = await gql<{ draftOrderCreate: { draftOrder: { id: string } | null; userErrors: Array<{ message: string }> } }>(
    admin,
    DRAFT_CREATE,
    buildDraftInput(p),
  );
  const draft = created.draftOrderCreate.draftOrder;
  if (!draft || created.draftOrderCreate.userErrors.length) {
    throw new CodError("internal", 502, "Draft order could not be created", {
      shopifyErrors: created.draftOrderCreate.userErrors.map((e) => e.message),
    });
  }
  try {
    const done = await gql<{
      draftOrderComplete: { draftOrder: { order: { id: string; name: string; paymentGatewayNames: string[] } | null } | null; userErrors: Array<{ message: string }> };
    }>(admin, DRAFT_COMPLETE, { id: draft.id, paymentGatewayId: p.paymentGatewayId || null });
    const order = done.draftOrderComplete.draftOrder?.order;
    if (!order || done.draftOrderComplete.userErrors.length) {
      const msgs = done.draftOrderComplete.userErrors.map((e) => e.message);
      if (msgs.some((m) => /inventory|stock/i.test(m))) throw new CodError("sold_out", 409, "One of the items just sold out.");
      throw new CodError("internal", 502, "Draft order could not be completed", { shopifyErrors: msgs });
    }
    return { orderId: order.id, orderName: order.name, paymentGatewayNames: order.paymentGatewayNames };
  } catch (e) {
    await gql(admin, DRAFT_DELETE, { input: { id: draft.id } }).catch(() => undefined);
    throw e;
  }
}

export function createOrder(admin: AdminLike, p: CreateOrderParams): Promise<CreatedOrder> {
  return p.path === "draft_order" ? createViaDraftOrder(admin, p) : createViaOrderCreate(admin, p);
}
