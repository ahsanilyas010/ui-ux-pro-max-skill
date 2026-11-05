# PERF-NOTES — HandPicked Editorial

Measured with `gzip -c` (default level) on `assets/*`, theme state after the motion/perf pass. GSAP is external and excluded from budgets.

## 1. Gzip size per asset

| Asset | gz bytes | | Asset | gz bytes |
|---|---:|---|---|---:|
| base.css | 6,510 | | global.js | 5,897 |
| component-product.css | 3,474 | | cart.js | 4,991 |
| component-home.css | 2,337 | | motion.js | 3,605 |
| component-cart.css | 2,094 | | product-form.js | 2,936 |
| component-header.css | 1,854 | | variant-picker.js | 2,638 |
| component-motion.css | 1,367 | | product-gallery.js | 2,258 |
| component-collection.css | 1,410 | | facets.js | 2,102 |
| component-product-card.css | 1,387 | | predictive-search.js | 1,966 |
| component-search.css | 1,036 | | pk-cities.js (COD) | 1,531 |
| component-footer.css | 1,014 | | recently-viewed.js | 1,444 |
| component-hero.css | 1,026 | | load-more.js | 1,426 |
| component-content.css | 972 | | size-guide.js | 1,314 |
| component-brands.css | 816 | | product-recommendations.js | 1,274 |
| component-customers.css | 575 | | quick-add.js | 674 |
| | | | countdown.js | 655 |

All CSS in the theme: about 25.8 KB gz. All JS in the theme: about 36 KB gz (incl. pk-cities.js).
External, homepage only, after `load`: gsap 3.13.0 core (about 27 KB gz) + ScrollTrigger (about 12 KB gz) from cdn.jsdelivr.net.

## 2. What each template loads

Always (layout/header/footer/overlay groups): `base.css` (preloaded), `component-header.css`, `component-footer.css`, `component-cart.css` + `cart.js` (cart drawer), `component-search.css` + `predictive-search.js` (search drawer), `global.js`, `motion.js` (defer, skipped when motion = off), then `component-motion.css` (injected by motion.js, non-blocking).

| Template | Extra CSS | Extra JS | JS gz total | CSS gz total |
|---|---|---|---:|---:|
| index | home, hero, product-card | countdown | 17.1 KB | 18.6 KB |
| collection | collection, product-card | facets, load-more, quick-add | 20.6 KB | 16.6 KB |
| search | collection, product-card, search | facets, load-more, quick-add | 20.6 KB | 16.6 KB |
| product | product, product-card | product-form, variant-picker, product-gallery, size-guide, product-recommendations, recently-viewed (+ COD form files when added) | 28.3 KB | 18.7 KB |
| cart | (cart already global) | (cart.js already global) | 16.4 KB | 13.8 KB |
| page / blog / article / faq / about | content | none | 16.4 KB | 14.8 KB |
| list-collections | brands | none | 16.4 KB | 14.6 KB |

## 3. Budget check

- JS on PLP/PDP, excluding GSAP: PLP 20.6 KB, PDP 28.3 KB, budget 60 KB. PASS, about 31 KB of headroom on PDP for the COD form (cod-form.js + pk-cities.js 1.5 KB).
- CSS total: 25.8 KB across every file, budget 40 KB. PASS (worst page, PDP, loads 18.7 KB).
- Every section loads its stylesheet at the top with `stylesheet_tag`; every script tag in sections has `defer`. `layout/theme.liquid` loads global.js and motion.js with `defer`. No render-blocking third-party requests.
- GSAP: loaded only when `pageType === 'index'`, motion level `standard` and `motion_gsap_home` on; after `window.load`, through `requestIdleCallback` (timeout 3 s; fallback `setTimeout` 1 s). Failure to load leaves CSS reveals in charge.

## 4. Image priority and lazy audit

- Hero: `priority: true` on the desktop and mobile images (eager + fetchpriority high). Both hero image variants are in the DOM and one is `display:none` per breakpoint; the hidden one is still `priority` (see recommendation 1).
- PLP (main-collection) and search: first 4 cards on page 1 are `priority`; the rest lazy; the hover (alt) image is always `loading="lazy"`.
- Homepage featured collections: `priority_images` setting defaults to false (they sit below the hero). Correct.
- PDP gallery, recommendations, recently viewed, editorial banner, brand logos, category tiles, instagram: lazy (recommendations and recently viewed are `priority: false`).
- Fix applied: `featured-collection`, `product-recommendations` and `recently-viewed` rendered product cards but did not load `component-product-card.css` (only `main-collection` and `main-search` did), so cards on the homepage and PDP would have been unstyled. A stylesheet tag was added at the top of those three sections.

## 5. CLS risks

| Risk | Status |
|---|---|
| Hero | Fixed `min-height` (dvh), media absolutely positioned, so no shift. Content no longer starts at opacity 0 (see motion notes). |
| Announcement bar | `min-height: var(--announcement-height)` (36px). Under 750px it is one static message that may wrap to two lines on very narrow phones; it is server-rendered, so there is no shift after paint. |
| Header | Server-rendered with fixed height token; shrink-on-scroll uses transforms only. |
| Product images | All inside `.media` frames with fixed aspect ratio; brand logos carry width/height. |
| Web fonts | `font-display: swap` plus preload of the two Shopify-hosted families. Fallback metrics (size-adjust, ascent-override) are NOT defined yet, so a small text reflow remains when Playfair/Inter swap in. |
| Variant change on PDP | Price/stock/ATC parts are swapped in place; they have stable single-line heights. Low risk. |
| Recommendations / recently viewed | Fetched on demand below the fold; the section grows when it fills. Low risk (below the fold) but a `min-height` placeholder would remove it. |
| `content-visibility: auto` (`.cv-auto`) | Applied only to far-below-the-fold homepage sections, recommendations, recently viewed and the footer, never to sections with drawers, COD slots, marquees or hero media. `contain-intrinsic-size: auto 720px` remembers the real size after first render. Slight scrollbar jitter possible on the first scroll. |
| Sticky ATC / drawers / toasts | Fixed-position, so they do not move content. |
| Add-to-cart check overlay | Absolutely positioned inside the button; no layout change. |

## 6. Motion notes (what was added)

- `motion.js` keeps the baseline reveal behaviour and the `data-motion-ready` gate. Under `prefers-reduced-motion` or level `off` there are no reveals, no micro-interactions and no GSAP; the CSS inject and `.cv-auto` still run (reduced motion only).
- `component-motion.css` is injected once by `motion.js` (URL derived from its own `src`). It holds `.cv-auto`, the add-to-cart check overlay, the badge bump, the cart drawer item stagger, the free-shipping fill, and the draw-the-check classes.
- Homepage hero: GSAP animates transform only (media 1.04 to 1, content children y 24 to 0). `data-reveal` was removed from `.hero__content` so the headline is never hidden waiting for JS (LCP and no-JS safety). Featured grids keep the CSS stagger; ScrollTrigger only fires it at "top 85%". Editorial image parallax (6 percent, scrub 0.5) runs at 750px and up.
- Cart drawer item stagger and free-shipping fill run while `hp-drawer[data-stagger]` is set (open + about 900 ms), level `standard` only.
- Collection and search grids have no reveal attributes (verified); reveals exist only on homepage and static content sections.
- View transitions: none present (verified by grep); nothing added.
- Announcement bar under 750px: one static message, no animation, pause button hidden (`component-header.css`). Brand marquee: animated and pausable from 750px; under 750px a static swipeable strip (`component-home.css`).
- Cart undo after removal: `UNDO_MS = 12000` in `cart.js`, paused while the undo control is hovered or focused. No change needed.
- COD success check (class hooks, because `snippets/cod-form.liquid` does not exist yet): in the success screen render
  `<svg class="hp-check" viewBox="0 0 52 52" aria-hidden="true"><circle class="hp-check__circle" cx="26" cy="26" r="24" pathLength="1"/><path class="hp-check__tick" d="M15 27l8 8 14-16" pathLength="1"/></svg>`
  inside an element with `data-cod-success` (or add `.is-drawn` to the svg). Circle draws in 500 ms, tick in 400 ms; reduced motion shows it complete.

## 7. Recommendations (not changed here)

1. Hero: render only the active image for each breakpoint, or give the hidden variant `loading="lazy"`; today both hero images may be fetched with high priority on mobile. Use `<picture>` with a media query in `sections/hero.liquid`.
2. PLP/search: eager-load only the first 2 cards on mobile (4 on desktop) so fetchpriority is not spent on off-screen images.
3. `snippets/css-variables.liquid`: add fallback `@font-face` with `size-adjust`, `ascent-override`, `descent-override` for Playfair Display and Inter.
4. Reserve height for product-recommendations and recently-viewed (`min-height` on the placeholder).
5. `cart.js` (5 KB gz) loads on every page because the drawer is global; acceptable, but it could be deferred to first drawer open if the JS budget gets tight after the COD form lands.
6. When cod-form.js lands on the PDP, load it with `defer` only on product/cart templates and re-run the budget (currently 28.3 KB gz on PDP, 60 KB cap).
7. Ask Ahsan to set the shop money format to `PKR {{amount_no_decimals}}`; unrelated to speed but it keeps `HP.money` and Liquid output consistent.
