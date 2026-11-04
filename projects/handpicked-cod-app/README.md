# HandPicked COD Quick Order

A Shopify custom app (React Router 7 + `@shopify/shopify-app-react-router` + Prisma) for HandPicked.pk
(`hand-picked-online.myshopify.com`). The storefront theme posts a one-tap Cash on Delivery order to an
**app proxy** endpoint; the app validates it, applies anti-fraud checks and creates a real Shopify order
(payment status pending, gateway "Cash on Delivery (COD)").

Native Shopify checkout with its manual COD payment method is **kept as the fallback**. Do not remove that
payment method: the theme links customers to `/checkout` whenever the quick order fails or is disabled.

## What it does

- `POST /apps/cod/order` creates the order (default path: `orderCreate`).
- `POST /apps/cod/quote`, `GET /apps/cod/cities`, `GET /apps/cod/recent`, `GET /apps/cod/health`.
- Validation: Pakistani mobile normalisation (`+923XXXXXXXXX`), ~150 city list with alias/typo matching,
  honeypot field, minimum render time, per-IP and per-phone rate limits, 15 minute idempotent dedupe.
- Variant checks: product must be `ACTIVE` and published on the Online Store, variant sellable, and quantity
  must not exceed stock when the inventory policy is `DENY`.
- Risk gate for **new phone numbers** (no prior created COD order): junk city, high value, velocity
  (same variant ordered 3 or more times in 24 hours) and prior refusals. Flagged orders are created tagged
  `needs-confirmation` for WhatsApp confirmation. New phones above the high-value cap (default PKR 15,000,
  configurable) additionally get `advance-required` and the response `status` is `advance_required`
  so the theme can ask for a small Easypaisa/JazzCash/Raast advance.
- `orders/cancelled` webhook records refusals and auto-blocks a phone at 2 refusals (a junk-city order counts double).
- Admin UI: settings page and a COD orders page with the phone blocklist.

## Order creation paths

| Path | When | Notes |
| --- | --- | --- |
| `orderCreate` (default) | `Setting.useDraftOrder = false` and `USE_ORDER_CREATE` is not `false` | `financialStatus: PENDING`, transaction `{kind: SALE, status: PENDING, gateway: "Cash on Delivery (COD)", amountSet}`, options `inventoryBehaviour: DECREMENT_OBEYING_POLICY`, `sendReceipt: false`. `sourceName` is omitted; `sourceIdentifier` holds the idempotency key. Shipping line "Standard Delivery (PostEx)". |
| `draftOrderCreate` + `draftOrderComplete` | flag on | Optional `paymentTerms.paymentTermsTemplateId` and `paymentGatewayId`. Failed completion deletes the draft. |

Field names for both were checked against the Admin GraphQL schema (API `2026-10`). Inventory claim failures
map to HTTP `409 sold_out`. Admin API 2026-10 rejects the deprecated `collectionByHandle` query and
`Collection.ruleSet`; this app uses neither.

Not verified against a live store: whether `orderCreate` accepts the custom gateway string in your plan's
configuration, and the exact display of the pending COD transaction in the admin. Test with
**Test mode** on a draft/dev flow first (orders get `test: true`).

## Proxy contract

`POST {{ settings.cod_proxy_path }}/order` (same origin, JSON). Body:

```json
{ "lines": [{ "variantId": 1234567890, "quantity": 1 }], "name": "…", "phone": "03XXXXXXXXX", "city": "Lahore",
  "address": "…", "note": "", "email": "", "source": "pdp|drawer|cart", "website": "", "renderedAt": 1730000000000,
  "cartToken": "…", "utm": { "source": "", "medium": "", "campaign": "" } }
```

Money is in paisa. Responses (always `application/json`, `Cache-Control: no-store`, never `application/liquid`):

| Status | Body |
| --- | --- |
| 200 | `{ok, status: "created"\|"needs_confirmation"\|"advance_required", orderName, orderId, subtotal, shipping, total, eta, whatsapp, test, advance?}` |
| 400 | `{ok:false, code:"bad_request"}` |
| 403 | `{ok:false, code:"forbidden"}` (wrong shop) |
| 409 | `{ok:false, code:"sold_out"}` (inventory race) or order in progress |
| 410 | `{ok:false, code:"sold_out", variants:[{variantId, reason, available?}]}` |
| 422 | `{ok:false, code:"validation"\|"blocked", errors:{field:message}}` |
| 429 | `{ok:false, code:"rate_limited"}` with `Retry-After` |
| 503 | quick order disabled |
| 5xx | `{ok:false, code:"internal"}` |

The honeypot field `website` returns a fake `200` (`orderName: "#PENDING"`) and creates nothing.
`GET /apps/cod/recent` returns `[{firstName, city, product, minutesAgo}]`: first name and city only, only
verified-city orders that were not held for confirmation.

## Merchant setup

1. In the Shopify Dev Dashboard create an app ("HandPicked COD Quick Order") with custom distribution for
   `hand-picked-online.myshopify.com`.
2. Replace `REPLACE_WITH_APP_URL` in `shopify.app.toml` with your hosted URL, then:
   ```bash
   npm install
   npm run config:link      # shopify app config link
   npm run deploy           # shopify app deploy  (pushes scopes, webhooks, app proxy)
   ```
3. Install the app on the store. Scopes: `write_orders, write_draft_orders, read_products, read_inventory,
   read_orders, read_customers`.
4. **Protected Customer Data**: in the Dev Dashboard (API access > Protected customer data) declare access to
   customer name, phone, email and address, with the reason "Create and fulfil customer-placed Cash on Delivery
   orders and prevent fraud". Without this declaration, order and customer fields come back redacted/blocked.
5. Copy `.env.example` to `.env` (or set the variables on your host), run `npm run setup`, deploy.
6. Open the app in admin, set delivery threshold and fee (must match the theme settings and Shopify shipping
   rates), WhatsApp number, high-value cap, and leave **Test mode** on until the first real order is verified.
7. Theme side: set `cod_proxy_path` to `/apps/cod` and enable the COD settings.

Finding IDs (draft path only): in the app settings click **List templates** under "Find payment terms
templates" to get `paymentTermsTemplateId`. The gateway ID is optional; for a manual payment method it is the
`gid://shopify/PaymentGateway/...` of the method you created under Settings > Payments > Manual payment methods.

## Hosting

- **Docker (Fly/Railway/Render):** `docker build`, mount a volume at `/data` for sqlite, or point `DATABASE_URL`
  at Postgres. `docker-start` runs `prisma generate && prisma migrate deploy` on boot.
- **Postgres / Vercel:** edit `prisma/schema.prisma`: `provider = "postgresql"`, set `DATABASE_URL`, delete
  `prisma/migrations`, run `npx prisma migrate dev --name init` once against Postgres, commit the new migration.
  Serverless needs a pooled connection string.

## Security notes

- Every proxy request is verified by `authenticate.public.appProxy` (Shopify HMAC signature). `ALLOWED_SHOP`
  pins the app to one shop.
- Rate limits: 5 orders per 10 min per IP, 3 per hour per phone. Dedupe hash is claimed in the database before
  the Shopify call so concurrent double taps cannot create two orders.
- Logs never contain full phone numbers or addresses.
- The optional order webhook is signed with HMAC-SHA256 (`X-HandPicked-Signature: sha256=...`, secret
  `WHATSAPP_WEBHOOK_SECRET`).
- Compliance webhooks are implemented: `customers/data_request` (acknowledged, answer from Shopify admin; the
  app stores only normalised phone, first name, city and order name), `customers/redact`, `shop/redact`.

## Testing

```bash
npm run test        # vitest: phone, cities, shipping, dedupe, risk, variant validation, order input shapes
npm run typecheck
npm run lint
```
Manual: set Test mode, post from the theme or `curl` through the store domain `/apps/cod/health` (must return
`{"ok":true}`), place an order, confirm tags `COD, quick-order, src:*, city:*` and a pending COD transaction.

## Known limits and phase 2

- "New phone" means no earlier created COD order from this app for that number; it does not read the store's
  full order history.
- Meta Conversions API for cancelled COD orders is phase 2 (the theme fires the browser Pixel Purchase with
  `eventID = orderName`).
- No order-confirmation email is sent (`sendReceipt: false`); confirmation happens on WhatsApp.

## Rollback

Turn off **Accept quick orders** in the app (the theme falls back to `/checkout`, which still has native COD),
or disable `cod_enabled` in theme settings. Uninstalling the app removes the proxy; existing orders are normal
Shopify orders and are unaffected.
