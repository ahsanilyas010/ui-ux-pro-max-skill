/* HandPicked Editorial — global.js
   Shared runtime: pubsub, money, section fetch, focus trap, drawers, toasts, cart API, quantity, tabs, header.
   Vanilla ES2019, no dependencies. Every other script assumes this has loaded (defer order). */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const doc = document;

  /* ---------- Pub/sub ---------- */
  const subs = new Map();
  HP.on = function (evt, fn) {
    if (!subs.has(evt)) subs.set(evt, new Set());
    subs.get(evt).add(fn);
    return () => subs.get(evt).delete(fn);
  };
  HP.off = (evt, fn) => subs.get(evt) && subs.get(evt).delete(fn);
  HP.emit = function (evt, data) {
    (subs.get(evt) || []).forEach((fn) => {
      try { fn(data); } catch (e) { console.error('[HP]', evt, e); }
    });
    doc.dispatchEvent(new CustomEvent('hp:' + evt, { detail: data }));
  };

  /* ---------- Utils ---------- */
  HP.qs = (sel, ctx) => (ctx || doc).querySelector(sel);
  HP.qsa = (sel, ctx) => Array.from((ctx || doc).querySelectorAll(sel));
  HP.debounce = function (fn, wait) {
    let t;
    return function () { clearTimeout(t); const a = arguments, c = this; t = setTimeout(() => fn.apply(c, a), wait); };
  };
  HP.ready = (fn) => (doc.readyState === 'loading' ? doc.addEventListener('DOMContentLoaded', fn, { once: true }) : fn());
  HP.prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  HP.isTouch = () => window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  HP.uid = (p) => (p || 'hp') + '-' + Math.random().toString(36).slice(2, 9);

  /* ---------- Money (mirrors Shopify money filters) ---------- */
  HP.money = function (cents, format) {
    const fmt = format || (HP.shop && HP.shop.moneyFormat) || 'Rs.{{amount_no_decimals}}';
    const value = Number(cents || 0) / 100;
    const sep = (n, thousands, decimal, decimals) => {
      const fixed = Math.abs(n).toFixed(decimals);
      const parts = fixed.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousands);
      return (n < 0 ? '-' : '') + parts.join(decimal);
    };
    const map = {
      amount: sep(value, ',', '.', 2),
      amount_no_decimals: sep(value, ',', '.', 0),
      amount_with_comma_separator: sep(value, '.', ',', 2),
      amount_no_decimals_with_comma_separator: sep(value, '.', ',', 0),
      amount_with_apostrophe_separator: sep(value, "'", '.', 2),
      amount_with_space_separator: sep(value, ' ', ',', 2),
      amount_no_decimals_with_space_separator: sep(value, ' ', ',', 0),
      amount_with_period_and_space_separator: sep(value, ' ', '.', 2)
    };
    return fmt.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (k in map ? map[k] : m));
  };

  /* ---------- Section Rendering API helpers ---------- */
  HP.fetchSection = async function (sectionId, url) {
    const u = new URL(url || window.location.href, window.location.origin);
    u.searchParams.set('section_id', sectionId);
    const res = await fetch(u.toString(), { headers: { Accept: 'text/html' } });
    if (!res.ok) throw new Error('Section fetch failed: ' + res.status);
    return res.text();
  };
  HP.parseHTML = (html) => new DOMParser().parseFromString(html, 'text/html');
  HP.replaceSection = function (sectionId, html, selector) {
    const fresh = HP.parseHTML(html);
    const target = doc.getElementById('shopify-section-' + sectionId) || doc.querySelector(selector || '[data-section-id="' + sectionId + '"]');
    const source = fresh.getElementById('shopify-section-' + sectionId) || fresh.body.firstElementChild;
    if (target && source) { target.innerHTML = source.innerHTML; HP.emit('section:replaced', { sectionId, target }); }
    return target;
  };

  /* ---------- Scroll lock & focus trap ---------- */
  let lockCount = 0;
  HP.lockScroll = function () {
    if (lockCount++ === 0) {
      const sb = window.innerWidth - doc.documentElement.clientWidth;
      doc.body.style.paddingRight = sb > 0 ? sb + 'px' : '';
      doc.body.classList.add('has-overlay');
    }
  };
  HP.unlockScroll = function () {
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) { doc.body.classList.remove('has-overlay'); doc.body.style.paddingRight = ''; }
  };
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  HP.getFocusable = (el) => HP.qsa(FOCUSABLE, el).filter((n) => n.offsetParent !== null || n === doc.activeElement);
  HP.trapFocus = function (container, initial) {
    HP.releaseFocus();
    const first = initial || HP.getFocusable(container)[0] || container;
    container.setAttribute('tabindex', container.getAttribute('tabindex') || '-1');
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      const f = HP.getFocusable(container);
      if (!f.length) { e.preventDefault(); container.focus(); return; }
      const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && doc.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && doc.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    doc.addEventListener('keydown', handler);
    HP._trap = { container, handler, previous: doc.activeElement };
    requestAnimationFrame(() => first.focus({ preventScroll: true }));
  };
  HP.releaseFocus = function () {
    if (!HP._trap) return;
    doc.removeEventListener('keydown', HP._trap.handler);
    const prev = HP._trap.previous;
    HP._trap = null;
    if (prev && prev.focus) prev.focus({ preventScroll: true });
  };

  /* ---------- Toast ---------- */
  HP.toast = function (message, opts) {
    opts = opts || {};
    const region = doc.getElementById('HPToastRegion');
    if (!region) return;
    const el = doc.createElement('div');
    el.className = 'toast' + (opts.type ? ' toast--' + opts.type : '');
    el.setAttribute('role', opts.type === 'error' ? 'alert' : 'status');
    let inner = '';
    if (opts.image) inner += '<div class="toast__media"><img src="' + opts.image + '" alt="" width="44" height="56" loading="lazy"></div>';
    inner += '<div class="toast__body">' + (opts.title ? '<span class="toast__title">' + opts.title + '</span>' : '') + '<span>' + message + '</span>' + (opts.actionLabel && opts.actionHref ? '<a class="link" href="' + opts.actionHref + '">' + opts.actionLabel + '</a>' : '') + '</div>';
    inner += '<button class="toast__close" type="button" aria-label="' + ((HP.strings && HP.strings.close) || 'Close') + '">&times;</button>';
    el.innerHTML = inner;
    region.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    const remove = () => { el.classList.remove('is-visible'); setTimeout(() => el.remove(), 300); };
    el.querySelector('.toast__close').addEventListener('click', remove);
    const t = setTimeout(remove, opts.duration || 4500);
    el.addEventListener('mouseenter', () => clearTimeout(t), { once: true });
    return el;
  };

  /* ---------- Cart API ---------- */
  const jsonHeaders = { 'Content-Type': 'application/json', Accept: 'application/json' };
  async function cartRequest(url, body, sections) {
    const payload = Object.assign({}, body || {});
    if (sections && sections.length) { payload.sections = sections.join(','); payload.sections_url = window.location.pathname; }
    const res = await fetch(url, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.description || data.message || (HP.strings && HP.strings.cartError) || 'Cart error');
      err.status = res.status; err.data = data; throw err;
    }
    return data;
  }
  HP.cart = {
    sectionsToRender: [],
    registerSections(ids) { ids.forEach((id) => { if (!HP.cart.sectionsToRender.includes(id)) HP.cart.sectionsToRender.push(id); }); },
    async get() { const r = await fetch(HP.routes.cart + '.js', { headers: { Accept: 'application/json' } }); return r.json(); },
    async add(items, opts) {
      opts = opts || {};
      const body = Array.isArray(items) ? { items } : items;
      const data = await cartRequest(HP.routes.cartAdd + '.js', body, opts.sections || HP.cart.sectionsToRender);
      const cart = await HP.cart.get();
      HP.emit('cart:updated', { cart, sections: data.sections || {}, added: data, source: opts.source || 'add' });
      return { added: data, cart };
    },
    async change(idOrLine, quantity, opts) {
      opts = opts || {};
      const body = typeof idOrLine === 'number' ? { line: idOrLine, quantity } : { id: idOrLine, quantity };
      const cart = await cartRequest(HP.routes.cartChange + '.js', body, opts.sections || HP.cart.sectionsToRender);
      HP.emit('cart:updated', { cart, sections: cart.sections || {}, source: opts.source || 'change' });
      return cart;
    },
    async update(updates, opts) {
      opts = opts || {};
      const cart = await cartRequest(HP.routes.cartUpdate + '.js', updates, opts.sections || HP.cart.sectionsToRender);
      HP.emit('cart:updated', { cart, sections: cart.sections || {}, source: opts.source || 'update' });
      return cart;
    },
    async clear(opts) {
      opts = opts || {};
      const cart = await cartRequest(HP.routes.cartClear + '.js', {}, opts.sections || HP.cart.sectionsToRender);
      HP.emit('cart:updated', { cart, sections: cart.sections || {}, source: 'clear' });
      return cart;
    }
  };
  // Keep header cart counts in sync.
  HP.on('cart:updated', ({ cart }) => {
    HP.qsa('[data-cart-count]').forEach((el) => {
      el.textContent = cart.item_count;
      el.setAttribute('data-count', cart.item_count);
      const label = el.getAttribute('data-count-label');
      if (label) el.setAttribute('aria-label', label.replace('[count]', cart.item_count));
    });
  });

  /* ---------- <hp-drawer> ---------- */
  class HPDrawer extends HTMLElement {
    connectedCallback() {
      this.root = this.querySelector('.drawer') || this;
      this.panel = this.querySelector('.drawer__panel');
      this.querySelectorAll('[data-drawer-close]').forEach((b) => b.addEventListener('click', () => this.close()));
      this._onKey = (e) => { if (e.key === 'Escape' && this.isOpen) { e.stopPropagation(); this.close(); } };
      this.root.setAttribute('aria-hidden', 'true');
    }
    get isOpen() { return this.root.classList.contains('is-open'); }
    open(opener) {
      if (this.isOpen) return;
      HP.qsa('hp-drawer').forEach((d) => d !== this && d.isOpen && d.close(true));
      this.opener = opener || doc.activeElement;
      this.root.setAttribute('open', '');
      this.root.setAttribute('aria-hidden', 'false');
      requestAnimationFrame(() => this.root.classList.add('is-open'));
      HP.lockScroll();
      doc.addEventListener('keydown', this._onKey);
      const initial = this.querySelector('[data-drawer-focus]') || this.querySelector('.drawer__header button') || this.panel;
      HP.trapFocus(this.panel || this, initial);
      if (this.opener && this.opener.setAttribute) this.opener.setAttribute('aria-expanded', 'true');
      HP.emit('drawer:open', { id: this.id, drawer: this });
    }
    close(silent) {
      if (!this.isOpen) return;
      this.root.classList.remove('is-open');
      this.root.setAttribute('aria-hidden', 'true');
      doc.removeEventListener('keydown', this._onKey);
      const done = () => { this.root.removeAttribute('open'); };
      const dur = HP.prefersReducedMotion() ? 0 : 260;
      setTimeout(done, dur);
      if (!silent) HP.unlockScroll(); else HP.unlockScroll();
      HP.releaseFocus();
      if (this.opener && this.opener.setAttribute) this.opener.setAttribute('aria-expanded', 'false');
      HP.emit('drawer:close', { id: this.id, drawer: this });
    }
    toggle(opener) { this.isOpen ? this.close() : this.open(opener); }
  }
  if (!customElements.get('hp-drawer')) customElements.define('hp-drawer', HPDrawer);
  HP.openDrawer = (id, opener) => { const d = doc.getElementById(id); if (d && d.open) d.open(opener); return d; };
  HP.closeDrawer = (id) => { const d = doc.getElementById(id); if (d && d.close) d.close(); };
  doc.addEventListener('click', (e) => {
    const t = e.target.closest('[data-drawer-open]');
    if (!t) return;
    const id = t.getAttribute('data-drawer-open');
    const d = doc.getElementById(id);
    if (d && d.open) { e.preventDefault(); d.toggle(t); }
  });

  /* ---------- <hp-quantity> ---------- */
  class HPQuantity extends HTMLElement {
    connectedCallback() {
      this.input = this.querySelector('input');
      if (!this.input) return;
      this.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
        e.preventDefault();
        const dir = b.getAttribute('data-dir') === 'down' ? -1 : 1;
        this.set(Number(this.input.value || 0) + dir);
      }));
      this.input.addEventListener('change', () => this.set(Number(this.input.value)));
      this.sync();
    }
    set(v) {
      const min = Number(this.input.min || 1), max = this.input.max ? Number(this.input.max) : Infinity;
      v = Math.min(max, Math.max(min, isNaN(v) ? min : v));
      const changed = String(v) !== this.input.value;
      this.input.value = v;
      this.sync();
      if (changed) this.input.dispatchEvent(new Event('hp:change', { bubbles: true }));
    }
    sync() {
      const v = Number(this.input.value), min = Number(this.input.min || 1), max = this.input.max ? Number(this.input.max) : Infinity;
      const down = this.querySelector('[data-dir="down"]'), up = this.querySelector('[data-dir="up"]');
      if (down) down.disabled = v <= min;
      if (up) up.disabled = v >= max;
    }
  }
  if (!customElements.get('hp-quantity')) customElements.define('hp-quantity', HPQuantity);

  /* ---------- <hp-tabs> ---------- */
  class HPTabs extends HTMLElement {
    connectedCallback() {
      this.tabs = HP.qsa('[role="tab"]', this);
      this.panels = HP.qsa('[role="tabpanel"]', this);
      this.tabs.forEach((t, i) => {
        t.addEventListener('click', () => this.select(i));
        t.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowRight') this.select((i + 1) % this.tabs.length, true);
          if (e.key === 'ArrowLeft') this.select((i - 1 + this.tabs.length) % this.tabs.length, true);
        });
      });
      const initial = this.tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
      this.select(initial < 0 ? 0 : initial);
    }
    select(i, focus) {
      this.tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(i === j)); t.tabIndex = i === j ? 0 : -1; });
      this.panels.forEach((p, j) => { p.hidden = i !== j; });
      if (focus) this.tabs[i].focus();
    }
  }
  if (!customElements.get('hp-tabs')) customElements.define('hp-tabs', HPTabs);

  /* ---------- Exclusive <details> groups ---------- */
  doc.addEventListener('toggle', (e) => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open) return;
    const group = d.getAttribute('data-accordion-group');
    if (!group) return;
    HP.qsa('details[data-accordion-group="' + group + '"]').forEach((o) => { if (o !== d) o.open = false; });
  }, true);

  /* ---------- Header: scrolled state + announcement rotation fallback ---------- */
  HP.ready(() => {
    const header = doc.querySelector('[data-header]');
    if (header && 'IntersectionObserver' in window) {
      const sentinel = doc.createElement('div');
      sentinel.setAttribute('data-header-sentinel', '');
      sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none;';
      doc.body.prepend(sentinel);
      new IntersectionObserver(([entry]) => {
        header.classList.toggle('is-scrolled', !entry.isIntersecting);
        doc.body.classList.toggle('header-scrolled', !entry.isIntersecting);
      }, { rootMargin: '-40px 0px 0px 0px' }).observe(sentinel);
      const setH = () => doc.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
      setH(); window.addEventListener('resize', HP.debounce(setH, 150));
    }
    // Make any "details" with data-close-on-outside close when clicking elsewhere (mega menus).
    doc.addEventListener('click', (e) => {
      HP.qsa('details[data-close-on-outside][open]').forEach((d) => { if (!d.contains(e.target)) d.open = false; });
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') HP.qsa('details[data-close-on-outside][open]').forEach((d) => { d.open = false; d.querySelector('summary') && d.querySelector('summary').focus(); });
    });
  });

  /* ---------- Theme editor events ---------- */
  if (window.Shopify && window.Shopify.designMode) {
    doc.addEventListener('shopify:section:load', (e) => HP.emit('section:load', { target: e.target, sectionId: e.detail && e.detail.sectionId }));
    doc.addEventListener('shopify:block:select', (e) => {
      const drawer = e.target.closest && e.target.closest('hp-drawer');
      if (drawer && drawer.open) drawer.open();
    });
  }

  HP.emit('ready', {});
})();
