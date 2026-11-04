# NOTES — product page (pdp)

Contracts other areas can rely on
- `HP.pdp[sectionId] = { productId, variant /* Shopify variant JSON */, quantity, variants }` is kept current by `variant-picker.js`.
  A late subscriber to `variant:change` can read it instead of waiting for the initial emit (fired once, `initial: true`, after DOMContentLoaded + 0ms).
- `HP.emit('variant:change', { sectionId, productId, variant, quantity, initial? })` also fires on quantity change.
- `HP.emit('pdp:updated', { sectionId, variant })` fires after price/stock/ATC/delivery parts were swapped.
- COD slot: `<div class="product__cod-slot" data-cod-slot data-mode="product">` sits above the add-to-cart form, outside every swapped
  `[data-dynamic]` part, so the COD form is never re-rendered on variant change. `.product__buy .button` is forced to min-height 52px so the COD button and Add to cart are equal height.
- Sticky bar "Order on COD" button delegates a click to `[data-cod-slot] [data-cod-open], [data-cod-slot] button` (first match) and falls back to scrolling the buy block into view.
  The COD form should mark its opener with `data-cod-open` (or be the first button in the slot).
- Optional: the COD sheet can call `HP.emit('cod:city', { text: '4–7 working days to Multan' })` to rewrite the bold ETA in the delivery promise.
- Lightbox and size-guide `<hp-drawer>`s are moved to `<body>` on init so `HP.setInert` can inert the rest of the page.

Shared-file requests: none required.
Copy alignment still open outside this area: `trust.exchange` ("7-day easy exchange") and footer/FAQ/policy wording should use the same rule
as the PDP (`products.product.exchange_rule`: "7-day free size exchange; refund only if not as described").
Recently viewed relies on the storefront search supporting `handle:` field queries; if it does not match on the live store, switch the query to `id:`.
