/* HandPicked Editorial — product-recommendations.js
   Fetches Shopify Product Recommendations (related, optionally complementary) as Section Rendering HTML and
   drops each response's [data-recs-content] into its slot. Hides the section when nothing comes back. */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const bound = new WeakSet();

  async function load(section) {
    const sectionId = section.getAttribute('data-section-id');
    const productId = section.getAttribute('data-product-id');
    const limit = section.getAttribute('data-limit') || '8';
    const base = section.getAttribute('data-url') || (HP.routes && HP.routes.productRecommendations);
    if (!base || !productId) return;
    const intents = ['related'];
    if (section.getAttribute('data-complementary') === 'true') intents.push('complementary');

    const results = await Promise.all(intents.map(async (intent) => {
      try {
        const url = base + '?section_id=' + encodeURIComponent(sectionId) + '&product_id=' + encodeURIComponent(productId) + '&limit=' + limit + '&intent=' + intent;
        const res = await fetch(url, { headers: { Accept: 'text/html' } });
        if (!res.ok) return null;
        const doc = HP.parseHTML(await res.text());
        return doc.querySelector('[data-recs-content]');
      } catch (e) { return null; }
    }));

    let any = false;
    results.forEach((node, i) => {
      const slot = section.querySelector('[data-recs-slot="' + intents[i] + '"]');
      if (!slot) return;
      if (node && node.querySelector('.recs__item')) {
        slot.innerHTML = node.innerHTML;
        any = true;
      } else {
        slot.innerHTML = '';
      }
    });
    section.hidden = !any;
    if (any) HP.emit('recs:loaded', { sectionId });
  }

  function init(section) {
    if (bound.has(section)) return;
    bound.add(section);
    if ('IntersectionObserver' in window) {
      // Load a little before the section scrolls into view; saves a request for bounced visits.
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(section); }
      }, { rootMargin: '600px 0px' });
      // The section is hidden until loaded, so observe its parent flow position via a sentinel.
      const sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;';
      section.parentNode.insertBefore(sentinel, section);
      io.observe(sentinel);
    } else {
      load(section);
    }
  }

  function boot() {
    document.querySelectorAll('[data-product-recommendations]').forEach(init);
    HP.on('section:load', ({ target }) => { if (target) target.querySelectorAll('[data-product-recommendations]').forEach(init); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
