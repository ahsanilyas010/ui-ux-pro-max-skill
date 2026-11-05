/* HandPicked Editorial — product-form.js
   Add to cart (fetch via HP.cart.add), mobile sticky bar, share, collapsible description,
   sticky info column and the delivery-tier hook for the COD sheet.
   Uses HP.pdp[sectionId] = { variant, quantity } written by variant-picker.js. */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const bound = new WeakSet();

  function init(section) {
    if (bound.has(section)) return;
    bound.add(section);
    const sectionId = section.getAttribute('data-section-id');
    const state = () => (HP.pdp && HP.pdp[sectionId]) || { variant: null, quantity: 1 };
    const form = section.querySelector('.product__form');
    const errorEl = section.querySelector('[data-form-error]');
    const sticky = section.querySelector('[data-sticky-atc]');
    const buyBlock = section.querySelector('[data-buy-block]');

    /* ---------- Add to cart ---------- */
    function showError(msg) {
      if (errorEl) { errorEl.textContent = msg; errorEl.hidden = false; }
      HP.toast(msg, { type: 'error' });
    }
    function clearError() { if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; } }

    async function addToCart(buttons) {
      const st = state();
      const id = st.variant ? st.variant.id : Number((section.querySelector('[data-variant-id]') || {}).value);
      if (!id) return;
      const qtyInput = section.querySelector('[data-quantity-input]');
      const quantity = Math.max(1, Number(qtyInput ? qtyInput.value : st.quantity) || 1);
      clearError();
      buttons.forEach((b) => { b.setAttribute('aria-busy', 'true'); b.disabled = true; });
      try {
        await HP.cart.add([{ id, quantity }], { source: 'add' });
        buttons.forEach((b) => {
          b.classList.add('is-success');
          const label = b.querySelector('[data-add-label]');
          if (label && b.hasAttribute('data-label-added')) { label.dataset.prev = label.textContent; label.textContent = b.getAttribute('data-label-added'); }
        });
        setTimeout(() => {
          section.querySelectorAll('.is-success[data-add-to-cart], .is-success[data-sticky-add]').forEach((b) => {
            b.classList.remove('is-success');
            const label = b.querySelector('[data-add-label]');
            if (label && label.dataset.prev) { label.textContent = label.dataset.prev; delete label.dataset.prev; }
          });
        }, 1500);
      } catch (err) {
        showError(err && err.message ? err.message : (HP.strings && HP.strings.cartError) || 'Error');
      } finally {
        buttons.forEach((b) => { b.removeAttribute('aria-busy'); b.disabled = !(state().variant && state().variant.available); });
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const btn = form.querySelector('[data-add-to-cart]');
        if (!btn || btn.disabled || btn.getAttribute('aria-busy') === 'true') return;
        addToCart([btn]);
      });
    }

    /* ---------- Sticky bar ---------- */
    if (sticky) {
      let openDrawers = 0;
      let pastBuy = false;
      const body = document.body;
      const mq = window.matchMedia('(min-width: 990px)');

      const apply = () => {
        const show = pastBuy && openDrawers === 0 && !mq.matches;
        sticky.classList.toggle('is-visible', show);
        sticky.setAttribute('aria-hidden', String(!show));
        if (show) sticky.removeAttribute('inert'); else sticky.setAttribute('inert', '');
      };
      const measure = () => {
        if (mq.matches) { body.classList.remove('has-sticky-atc'); return; }
        body.classList.add('has-sticky-atc');
        document.documentElement.style.setProperty('--sticky-atc-h', sticky.offsetHeight + 'px');
      };

      if (buyBlock && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          // Only after the in-flow buy block has scrolled UP out of view (not while it is still below the fold).
          pastBuy = !entry.isIntersecting && entry.boundingClientRect.bottom < 0;
          apply();
        }, { threshold: 0 }).observe(buyBlock);
      }
      HP.on('drawer:open', () => { openDrawers += 1; apply(); });
      HP.on('drawer:close', () => { openDrawers = Math.max(0, openDrawers - 1); apply(); });
      mq.addEventListener ? mq.addEventListener('change', () => { measure(); apply(); }) : mq.addListener(() => { measure(); apply(); });
      window.addEventListener('resize', HP.debounce(measure, 200));
      measure();

      // Mirror size select <-> picker.
      const sizeIndex = Number(sticky.getAttribute('data-size-index'));
      sticky.addEventListener('change', (e) => {
        const sel = e.target.closest('[data-sticky-size]');
        if (!sel || sizeIndex < 0) return;
        const radio = Array.from(section.querySelectorAll('[data-variant-picker] input[data-option-index="' + sizeIndex + '"]')).find((r) => r.value === sel.value);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      });
      HP.on('variant:change', (d) => {
        if (!d || d.sectionId !== sectionId || !d.variant || sizeIndex < 0) return;
        const sel = sticky.querySelector('[data-sticky-size]');
        if (sel && sel.value !== d.variant.options[sizeIndex]) sel.value = d.variant.options[sizeIndex];
      });

      sticky.addEventListener('click', (e) => {
        const add = e.target.closest('[data-sticky-add]');
        if (add && !add.disabled) { addToCart([add]); return; }
      });
    }

    /* ---------- Share ---------- */
    section.querySelectorAll('[data-share]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const url = btn.getAttribute('data-share-url');
        const title = btn.getAttribute('data-share-title');
        if (navigator.share) {
          try { await navigator.share({ title, url }); } catch (err) { /* cancelled */ }
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          HP.toast(btn.getAttribute('data-copied') || 'Link copied', { type: 'light' });
        } catch (err) {
          window.prompt('', url);
        }
      });
    });

    /* ---------- Collapsible description ---------- */
    section.querySelectorAll('[data-description-text][data-collapse]').forEach((el) => {
      el.classList.add('is-clamped');
      if (el.scrollHeight <= el.clientHeight + 2) { el.classList.remove('is-clamped'); return; }
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'button button--text product__description-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.textContent = el.getAttribute('data-label-more');
      el.after(toggle);
      toggle.addEventListener('click', () => {
        const open = el.classList.toggle('is-clamped') === false;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? el.getAttribute('data-label-less') : el.getAttribute('data-label-more');
      });
    });

    /* ---------- Sticky info column (only when it fits the viewport) ---------- */
    const info = section.querySelector('[data-product-info]');
    if (info) {
      const check = () => {
        const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 64;
        info.classList.toggle('is-sticky', info.offsetHeight <= window.innerHeight - header - 32);
      };
      check();
      window.addEventListener('resize', HP.debounce(check, 200));
      HP.on('pdp:updated', check);
    }

  }

  function boot() {
    document.querySelectorAll('[data-product-section]').forEach(init);
    HP.on('section:load', ({ target }) => { if (target) target.querySelectorAll('[data-product-section]').forEach(init); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
