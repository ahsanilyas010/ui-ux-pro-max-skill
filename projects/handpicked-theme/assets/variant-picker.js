/* HandPicked Editorial — variant-picker.js
   Option selection → matching variant → update URL, hidden id, price/stock/sku/ATC/delivery parts
   (Section Rendering), then HP.emit('variant:change', { sectionId, productId, variant, quantity }).
   Shared state: HP.pdp[sectionId] = { variant, quantity, productId } (also read by product-form.js / COD form). */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  HP.pdp = HP.pdp || {};
  const PARTS = ['price', 'stock', 'sku', 'atc', 'delivery', 'sticky-price', 'sticky-atc'];
  const bound = new WeakSet();

  function parseVariants(root) {
    const el = root.querySelector('[data-variants]');
    try { return el ? JSON.parse(el.textContent) : []; } catch (e) { return []; }
  }
  const optionsOf = (v) => (v.options && v.options.length ? v.options : [v.option1, v.option2, v.option3].filter((o) => o != null));

  function init(section) {
    if (bound.has(section)) return;
    bound.add(section);
    const sectionId = section.getAttribute('data-section-id');
    const productId = Number(section.getAttribute('data-product-id'));
    const picker = section.querySelector('[data-variant-picker]');
    const variants = picker ? parseVariants(picker) : [];
    const qtyInput = section.querySelector('[data-quantity-input]');
    const state = (HP.pdp[sectionId] = HP.pdp[sectionId] || { productId, quantity: 1, variant: null, variants });
    state.variants = variants;
    state.quantity = qtyInput ? Number(qtyInput.value) || 1 : 1;

    const initialId = Number(section.getAttribute('data-initial-variant'));
    state.variant = variants.find((v) => v.id === initialId) || variants[0] || null;

    let token = 0;
    let controller = null;

    const groups = picker ? Array.from(picker.querySelectorAll('[data-option-group]')) : [];
    const readSelection = () => groups.map((g) => {
      const radio = g.querySelector('input[type="radio"]:checked');
      if (radio) return radio.value;
      const select = g.querySelector('select');
      return select ? select.value : null;
    });

    function markAvailability() {
      if (!picker) return;
      const selection = readSelection();
      groups.forEach((g, gi) => {
        const labelEl = g.querySelector('[data-selected-label]');
        if (labelEl) labelEl.textContent = selection[gi] || '';
        g.querySelectorAll('[data-pill]').forEach((pill) => {
          const input = pill.querySelector('input');
          const val = input.value;
          const candidate = selection.slice();
          candidate[gi] = val;
          const match = variants.find((v) => optionsOf(v).every((o, i) => o === candidate[i]));
          const available = !!(match && match.available);
          pill.classList.toggle('is-disabled', !available);
          const so = pill.querySelector('[data-soldout]');
          if (so) so.hidden = available;
        });
        const select = g.querySelector('select');
        if (select) {
          const label = picker.getAttribute('data-label-soldout') || '';
          Array.from(select.options).forEach((opt) => {
            const candidate = selection.slice();
            candidate[gi] = opt.value;
            const match = variants.find((v) => optionsOf(v).every((o, i) => o === candidate[i]));
            const base = opt.value;
            opt.textContent = match && match.available ? base : base + ' ' + label;
          });
        }
      });
    }

    function setUnavailable(on) {
      const notice = picker && picker.querySelector('[data-vp-notice]');
      const msg = picker ? picker.getAttribute('data-label-unavailable') : '';
      if (notice) { notice.textContent = on ? msg : ''; notice.hidden = !on; }
      section.querySelectorAll('[data-add-to-cart], [data-sticky-add]').forEach((btn) => {
        if (on) {
          btn.disabled = true; btn.setAttribute('aria-disabled', 'true');
          const lbl = btn.querySelector('[data-add-label]') || btn;
          lbl.textContent = msg;
        }
      });
    }

    function applyParts(html) {
      const doc = HP.parseHTML(html);
      const src = doc.querySelector('[data-section-id="' + sectionId + '"]') || doc;
      PARTS.forEach((name) => {
        const from = src.querySelector('[data-dynamic="' + name + '"]');
        const to = section.querySelector('[data-dynamic="' + name + '"]');
        if (from && to) to.innerHTML = from.innerHTML;
      });
      // Quantity cap follows the new variant's stock.
      const maxEl = section.querySelector('[data-dynamic="stock"] [data-max]');
      if (qtyInput && maxEl) {
        const max = Number(maxEl.getAttribute('data-max')) || Number(qtyInput.max) || 5;
        qtyInput.max = String(max);
        if (Number(qtyInput.value) > max) qtyInput.value = String(max);
        const qEl = qtyInput.closest('hp-quantity');
        if (qEl && qEl.sync) qEl.sync();
        state.quantity = Number(qtyInput.value) || 1;
      }
      // The form's variant id input is outside swapped parts; keep it in sync.
      const idInput = section.querySelector('[data-variant-id]');
      if (idInput && state.variant) idInput.value = state.variant.id;
      HP.emit('pdp:updated', { sectionId, variant: state.variant });
    }

    async function refresh(variant) {
      const myToken = ++token;
      if (controller) controller.abort();
      controller = 'AbortController' in window ? new AbortController() : null;
      try {
        const base = (picker && picker.getAttribute('data-product-url')) || window.location.pathname;
        const url = new URL(base, window.location.origin);
        url.searchParams.set('variant', variant.id);
        url.searchParams.set('section_id', sectionId);
        const res = await fetch(url.toString(), { headers: { Accept: 'text/html' }, signal: controller ? controller.signal : undefined });
        if (!res.ok) throw new Error('variant fetch ' + res.status);
        const html = await res.text();
        if (myToken !== token) return;
        applyParts(html);
      } catch (err) {
        if (err && err.name === 'AbortError') return;
        console.error('[HP] variant update failed', err);
      }
    }

    function emit(extra) {
      HP.emit('variant:change', Object.assign({ sectionId, productId, variant: state.variant, quantity: state.quantity }, extra || {}));
    }

    function onChange() {
      const selection = readSelection();
      markAvailability();
      const match = variants.find((v) => optionsOf(v).every((o, i) => o === selection[i]));
      if (!match) { state.variant = null; setUnavailable(true); return; }
      setUnavailable(false);
      state.variant = match;
      const idInput = section.querySelector('[data-variant-id]');
      if (idInput) idInput.value = match.id;
      try {
        const u = new URL(window.location.href);
        u.searchParams.set('variant', match.id);
        window.history.replaceState({}, '', u.toString());
      } catch (e) { /* ignore */ }
      emit();
      refresh(match);
    }

    if (picker) {
      picker.addEventListener('change', (e) => {
        if (e.target.matches('input[type="radio"], select')) onChange();
      });
      markAvailability();
    }

    // Quantity changes feed the COD form too.
    if (qtyInput) {
      qtyInput.addEventListener('hp:change', () => { state.quantity = Number(qtyInput.value) || 1; emit(); });
      qtyInput.addEventListener('change', () => { state.quantity = Number(qtyInput.value) || 1; });
    }

    // Initial broadcast, after every deferred script has had a chance to subscribe.
    setTimeout(() => emit({ initial: true }), 0);
  }

  // Section scripts load before global.js in document order, so touch HP only after DOMContentLoaded.
  function boot() {
    document.querySelectorAll('[data-product-section]').forEach(init);
    HP.on('section:load', ({ target }) => { if (target) target.querySelectorAll('[data-product-section]').forEach(init); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
