# HandPicked Editorial — Shopify Online Store 2.0 theme

Hand-coded theme for handpicked.pk (Shopify Basic, PKR, Pakistan). Premium-outlet editorial direction:
off-white / near-black / warm-gold accent, Playfair Display + Inter (Shopify-hosted), hairlines, 0–2px radius,
mobile-first (375px), CSS-first motion, one-tap Cash-on-Delivery order form backed by `projects/handpicked-cod-app`.

## Layout of the theme

```
layout/      theme.liquid, password.liquid
config/      settings_schema.json, settings_data.json
locales/     en.default.json
templates/   *.json (one `main-*` section each) · gift_card.liquid · customers/*.json
sections/    header-group.json, footer-group.json, overlay-group.json + one file per section
snippets/    css-variables, image, icon, meta-tags, json-ld, skeleton, payment-icons, social-icons, trust-row, …
assets/      base.css, global.js, component-<name>.css, <feature>.js
```

### Section ownership (contract)

| Template / group | Sections (file names are the contract) |
|---|---|
| `index.json` | `hero`, `trust-strip`, `brand-marquee`, `featured-collection` (×2: New in, Best sellers), `category-tiles`, `editorial-banner`, `promo-countdown`, `testimonials`, `instagram` |
| `collection.json` | `collection-banner`, `main-collection` |
| `list-collections.json` | `main-list-collections` (Brands A–Z) |
| `product.json` | `main-product`, `product-recommendations`, `recently-viewed` |
| `cart.json` | `main-cart`, `cart-upsells` |
| `search.json` | `main-search` |
| `page.json` / `page.about.json` / `page.faq.json` | `main-page` / `about-hero`, `about-values` / `faq-accordion` |
| `blog.json` / `article.json` | `main-blog` / `main-article` |
| `404.json`, `password.json`, `customers/*.json` | `main-404`, `main-password`, `main-customers-*` (done) |
| `header-group.json` | `announcement-marquee`, `header` (done) |
| `footer-group.json` | `footer` (done) |
| `overlay-group.json` | `cart-drawer`, `search-drawer` (shells exist — replace in place, keep ids `CartDrawer` / `SearchDrawer`) |

## Conventions (read before adding anything)

**Liquid**
- Every section starts with its stylesheet: `{{ 'component-<name>.css' | asset_url | stylesheet_tag }}`, then a wrapper with `data-section-id="{{ section.id }}"`.
- Section `{% schema %}`: literal English labels, `"presets"` for any section a merchant can add, `"enabled_on"` for group-only sections, `"blocks": [{"type":"@app"}]` wherever apps may inject (product, cart, footer, newsletter).
- Strings shown to shoppers go through `| t` using keys in `locales/en.default.json`. Add new keys under your area's namespace; never rename existing keys.
- Images: `{% render 'image', image: img, sizes: '(min-width: 990px) 25vw, 50vw', widths: '360,540,720,900', class: 'card__img', priority: true %}`. Always inside a `.media` frame (`.media--card` for products) so CLS stays 0.
- Icons: `{% render 'icon', name: 'bag', size: 20 %}` (names listed in `snippets/icon.liquid`). No emoji, no icon fonts.
- Money: `{{ price | money }}` in Liquid, `HP.money(cents)` in JS.
- Shipping/COD numbers come from `settings.shipping_free_threshold`, `settings.shipping_flat_rate`, `settings.shipping_eta`, `settings.cod_*` — never hard-code 3000/250.
- Trust row: `{% render 'trust-row', layout: 'row' | 'grid' | 'inline' %}`. Payment logos: `{% render 'payment-icons' %}`.

**CSS**
- Tokens only (`var(--color-accent)` etc., see `snippets/css-variables.liquid`). No hex values in components.
- BEM-ish: `.component`, `.component__element`, `.component--modifier`, state classes `.is-open`, `.is-selected`, `.is-revealed`.
- Mobile first; breakpoints `750px` (tablet) and `990px` (desktop). Touch targets ≥ 44px (`var(--tap-min)`).
- Reusable primitives already in `base.css`: `.container`, `.section`, `.section__header`, `.grid--2/3/4`, `.product-grid`, `.scroller`, `.media`, `.button*`, `.icon-button`, `.field*`, `.badge*`, `.pill`, `.chip`, `.price*`, `.card*`, `.tile`, `.drawer*`, `.toast*`, `.accordion`, `.tabs`, `.skeleton*`, `.marquee`, `.breadcrumbs`, `.empty-state`, `.notice`.
- Motion hooks: add `data-reveal` to a block or `data-reveal-stagger` to a grid; `motion.js` reveals them. Without JS everything is visible. Only animate `transform`/`opacity`.

**JavaScript**
- Vanilla, ES2019, one file per feature in `assets/`, loaded with `defer` from the section that needs it (`<script src="{{ 'facets.js' | asset_url }}" defer></script>` is fine; it de-dupes).
- Custom elements prefixed `hp-` (`hp-drawer`, `hp-quantity`, `hp-tabs` exist). Register with `if (!customElements.get(...))`.
- Shared runtime from `global.js` (`window.HP`): `HP.on/emit`, `HP.cart.add|change|update|get|clear` (emits `cart:updated` with `{cart, sections}`), `HP.cart.registerSections([...])` for Section Rendering, `HP.fetchSection(id, url)`, `HP.parseHTML`, `HP.replaceSection`, `HP.openDrawer(id)`, `HP.toast(msg, {type, image, title})`, `HP.trapFocus/releaseFocus`, `HP.money`, `HP.debounce`, `HP.routes`, `HP.settings`, `HP.strings`.
- Drawer markup pattern (any id):
  ```html
  <hp-drawer id="X"><div class="drawer [drawer--left|drawer--bottom]" role="presentation">
    <div class="drawer__overlay" data-drawer-close></div>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="X-title">
      <div class="drawer__header"><span id="X-title" class="drawer__title">…</span><button class="icon-button" data-drawer-close aria-label="…">…</button></div>
      <div class="drawer__body">…</div><div class="drawer__footer">…</div>
    </div></div></hp-drawer>
  ```
  Open with `<button data-drawer-open="X">` or `HP.openDrawer('X')`.
- No jQuery, no inline event handlers, no `document.write`, nothing blocking the add-to-cart button.

**Accessibility & performance**
- 16px base, visible focus (`:focus-visible` ring is global), `aria-expanded`/`aria-controls` on toggles, `role="list"` on styled lists, live regions for cart/COD feedback, `prefers-reduced-motion` respected (base.css does the heavy lifting).
- First 4 product cards and the hero image `priority: true`; everything else lazy. Fonts preloaded in `theme.liquid`. Budget: JS ≤ 60KB gz on PLP/PDP, CSS ≤ 40KB gz total, LCP < 2.5s on 4G, CLS < 0.1.

## COD quick-order contract (theme ↔ app)

`POST {{ settings.cod_proxy_path }}/order` (same origin, JSON):
```json
{ "lines": [{ "variantId": 1234567890, "quantity": 1 }], "name": "…", "phone": "03XXXXXXXXX", "city": "Lahore",
  "address": "…", "note": "", "email": "", "source": "pdp|drawer|cart", "website": "", "renderedAt": 1730000000000,
  "cartToken": "…", "utm": { "source": "", "medium": "", "campaign": "" } }
```
Responses: `200 {ok, orderName, orderId, subtotal, shipping, total, eta, whatsapp}` · `422 {errors:{field:msg}}` · `410 {variants:[…]}` · `429` · `5xx`. Totals are in PKR minor units (paisa) to match Shopify cents.

## Tooling

```bash
npm i -g @shopify/cli            # once
shopify theme check projects/handpicked-theme
node projects/handpicked-theme/scripts/push-theme.mjs --theme <gid>   # upload via Admin GraphQL (≤50 files/request)
shopify theme push --unpublished --path projects/handpicked-theme     # fallback from a machine logged into the store
```
Never run `shopify theme publish` / `themePublish` without written approval.
