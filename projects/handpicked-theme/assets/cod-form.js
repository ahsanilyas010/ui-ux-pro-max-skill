/* HandPicked Editorial - cod-form.js
   COD quick-order sheet. Delegated on document so it survives Section Rendering swaps (cart drawer) and
   section reloads. The sheet markup ships in a <template> inside the snippet and is moved to <body> on first open.
   Contract: POST {settings.cod_proxy_path}/order, see projects/handpicked-theme/README.md "COD quick-order contract".
   Amounts in responses are paisa (HP.money takes cents). Vanilla ES2019, depends on global.js + pk-cities.js. */
(function () {
  'use strict';
  var HP = window.HP;
  if (!HP || HP.cod) return;
  HP.cod = { version: 2 };

  var doc = document;
  var DRAFT_KEY = 'hp:cod:draft', LAST_KEY = 'hp:cod:last', UTM_KEY = 'hp:utm', FIRED_KEY = 'hp:cod:fired';
  var DRAFT_FIELDS = ['name', 'phone', 'city', 'address', 'note', 'email'];
  var MIN_RENDER_MS = 3100; // the app rejects orders submitted <3s after the sheet rendered (bot guard)
  var ctxs = {};

  /* ---------- storage (always guarded: private mode / blocked storage) ---------- */
  function ssGet(key) { try { return JSON.parse(window.sessionStorage.getItem(key)); } catch (e) { return null; } }
  function ssSet(key, val) { try { window.sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* ignore */ } }

  /* Keep the landing UTM params for the whole session (the shopper often navigates before ordering). */
  (function captureUtm() {
    try {
      var q = new URLSearchParams(window.location.search);
      var utm = { source: q.get('utm_source') || '', medium: q.get('utm_medium') || '', campaign: q.get('utm_campaign') || '' };
      if (utm.source || utm.medium || utm.campaign) ssSet(UTM_KEY, utm);
    } catch (e) { /* ignore */ }
  })();

  /* ---------- helpers ---------- */
  function tpl(str, vars) {
    return String(str || '').replace(/\[(\w+)\]/g, function (m, k) { return k in vars ? vars[k] : m; });
  }
  function money(c) { return HP.money(c); }
  function plain(c) { return HP.money(c, '{{amount_no_decimals}}'); }
  function cents(v) {
    if (typeof v === 'string' && v.indexOf('.') > -1) return Math.round(parseFloat(v) * 100);
    return Number(v) || 0;
  }
  function sized(src, w) {
    if (!src) return '';
    return src + (src.indexOf('?') > -1 ? '&' : '?') + 'width=' + w;
  }
  function el(tag, cls, text) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function q(ctx, sel) { return ctx.drawer.querySelector(sel); }
  function normPhone(v) {
    var s = String(v || '').replace(/[\s\-().]/g, '');
    if (!/^(?:\+92|0092|92|0)?3\d{9}$/.test(s)) return null;
    return '0' + s.slice(-10);
  }
  function showPhone(n) { return n.slice(0, 4) + ' ' + n.slice(4); }
  function ctxOf(node) {
    var d = node && node.closest ? node.closest('hp-drawer') : null;
    return d ? ctxs[d.id] : null;
  }

  /* ---------- open ---------- */
  async function open(trigger) {
    var root = trigger.closest('[data-cod-slot]');
    if (!root) return;
    var id = root.getAttribute('data-cod-id');
    var cfg;
    try { cfg = JSON.parse(root.querySelector('[data-cod-config]').textContent); } catch (e) { return; }

    var drawer = doc.getElementById(id);
    if (!drawer) {
      var tpl0 = root.querySelector('template[data-cod-template]');
      if (!tpl0) return;
      doc.body.appendChild(doc.importNode(tpl0.content, true));
      drawer = doc.getElementById(id);
    }
    if (!drawer) return;

    var ctx = ctxs[id] || (ctxs[id] = { id: id, tokens: 0, recs: {} });
    ctx.drawer = drawer;
    ctx.cfg = cfg;
    ctx.t = cfg.t;
    ctx.sid = root.getAttribute('data-section-id');
    ctx.mode = cfg.mode;
    ctx.productId = root.getAttribute('data-product-id') || '';
    ctx.productTitle = root.getAttribute('data-product-title') || '';
    ctx.productImage = root.getAttribute('data-product-image') || '';
    ctx.form = q(ctx, '[data-cod-form]');
    ctx.source = ctx.mode === 'product' ? 'pdp' : (trigger.closest('[data-cart-context="drawer"]') ? 'drawer' : 'cart');
    ctx.reopenCart = !!trigger.closest('#CartDrawer');
    ctx.succeeded = false;
    if (!ctx.ready) setup(ctx);

    trigger.setAttribute('aria-busy', 'true');
    try { await refresh(ctx); } finally { trigger.removeAttribute('aria-busy'); }
    resetView(ctx);
    ctx.renderedAt = Date.now();
    ctx.form.elements.renderedAt.value = String(ctx.renderedAt);
    if (drawer.open) drawer.open(trigger);
  }

  function setup(ctx) {
    ctx.ready = true;
    var list = q(ctx, '[data-cod-cities]');
    (HP.pkCities || []).forEach(function (c) { var o = doc.createElement('option'); o.value = c; list.appendChild(o); });
    var help = q(ctx, '[data-cod-eta]');
    ctx.cityHelp = help ? help.textContent : '';
    var draft = ssGet(DRAFT_KEY) || {};
    DRAFT_FIELDS.forEach(function (f) { if (draft[f] && ctx.form.elements[f]) ctx.form.elements[f].value = draft[f]; });
    cityChanged(ctx, true);
  }

  function resetView(ctx) {
    ctx.form.hidden = false;
    q(ctx, '[data-cod-success]').hidden = true;
    clearErrors(ctx);
    setBusy(ctx, false);
  }

  /* ---------- lines & totals ---------- */
  async function readLines(ctx) {
    if (ctx.mode === 'product') {
      var st = HP.pdp && HP.pdp[ctx.sid];
      var v = st && st.variant;
      if (!v) return [];
      var vt = v.public_title || v.title || '';
      return [{
        variantId: v.id, productId: ctx.productId, title: ctx.productTitle,
        variantTitle: vt && vt !== 'Default Title' ? vt : '',
        qty: Math.max(1, Number(st.quantity) || 1), price: Number(v.price) || 0,
        image: (v.featured_image && v.featured_image.src && sized(v.featured_image.src, 160)) || ctx.productImage,
        available: v.available !== false
      }];
    }
    var cart = await HP.cart.get();
    ctx.cartToken = cart.token || '';
    return (cart.items || []).map(function (i) {
      return {
        variantId: i.variant_id, productId: i.product_id, title: i.product_title,
        variantTitle: i.variant_title && i.variant_title !== 'Default Title' ? i.variant_title : '',
        qty: i.quantity, price: i.final_price, linePrice: i.final_line_price,
        image: i.image ? sized(i.image, 160) : '', available: true
      };
    });
  }

  async function refresh(ctx) {
    var lines;
    try { lines = await readLines(ctx); } catch (e) { lines = []; }
    ctx.lines = lines;
    var sub = 0;
    lines.forEach(function (l) { sub += l.linePrice != null ? l.linePrice : l.price * l.qty; });
    var threshold = Number(ctx.cfg.threshold) * 100, flat = Number(ctx.cfg.flat) * 100;
    ctx.subtotal = sub;
    ctx.delivery = sub > 0 && sub < threshold ? flat : 0;
    ctx.total = sub + ctx.delivery;
    ctx.blocked = !lines.length || lines.some(function (l) { return !l.available; });

    var ul = q(ctx, '[data-cod-lines]');
    ul.textContent = '';
    lines.forEach(function (l) {
      var li = el('li', 'cod__line');
      if (l.image) {
        var img = el('img', 'cod__thumb');
        img.src = l.image; img.alt = ''; img.width = 56; img.height = 70; img.loading = 'lazy';
        li.appendChild(img);
      }
      var info = el('div', 'cod__line-info');
      info.appendChild(el('span', 'cod__line-title', l.title));
      var meta = [l.variantTitle, tpl(ctx.t.qty, { count: l.qty })].filter(Boolean).join(' · ');
      info.appendChild(el('span', 'cod__line-meta', meta));
      li.appendChild(info);
      li.appendChild(el('span', 'cod__line-price', money(l.linePrice != null ? l.linePrice : l.price * l.qty)));
      ul.appendChild(li);
    });

    q(ctx, '[data-cod-subtotal]').textContent = money(sub);
    q(ctx, '[data-cod-delivery]').textContent = ctx.delivery ? money(ctx.delivery) : ctx.t.free;
    q(ctx, '[data-cod-total]').textContent = money(ctx.total);
    q(ctx, '[data-cod-consent]').textContent = tpl(ctx.t.consent, { total: plain(ctx.total) });

    var fallback = ctx.mode === 'product' ? '/cart/' + (lines[0] ? lines[0].variantId + ':' + lines[0].qty : '') : ctx.cfg.cartUrl;
    ctx.drawer.querySelectorAll('[data-cod-checkout]').forEach(function (a) { a.setAttribute('href', fallback || ctx.cfg.cartUrl); });

    var submit = q(ctx, '[data-cod-submit]');
    submit.disabled = ctx.blocked;
    if (!lines.length) showError(ctx, ctx.t.empty, false);
    else if (ctx.blocked) showError(ctx, ctx.t.errorSoldOut, false);
    else hideError(ctx);
    renderAddon(ctx);
  }

  async function renderAddon(ctx) {
    var box = q(ctx, '[data-cod-addon]');
    var token = ++ctx.tokens;
    var gap = Number(ctx.cfg.threshold) * 100 - ctx.subtotal;
    box.hidden = true;
    if (!ctx.lines.length || gap <= 0 || ctx.blocked) return;
    var pid = ctx.lines[0].productId;
    if (!pid) return;
    var recs = ctx.recs[pid];
    if (!recs) {
      try {
        var res = await fetch(HP.routes.productRecommendations + '.json?product_id=' + encodeURIComponent(pid) + '&limit=8&intent=related', { headers: { Accept: 'application/json' } });
        var json = await res.json();
        recs = ctx.recs[pid] = (json && json.products) || [];
      } catch (e) { recs = ctx.recs[pid] = []; }
    }
    if (token !== ctx.tokens) return;
    var picks = recs.filter(function (p) { return p.available && cents(p.price) >= gap; }).slice(0, 3);
    if (!picks.length) return;
    q(ctx, '[data-cod-addon-hint]').textContent = tpl(ctx.t.addonHint, { amount: plain(gap) });
    var ul = q(ctx, '[data-cod-addon-list]');
    ul.textContent = '';
    picks.forEach(function (p) {
      var li = el('li');
      var a = el('a', 'cod__addon-item');
      a.href = p.url;
      a.setAttribute('aria-label', tpl(ctx.t.addonView, { title: p.title }));
      var src = typeof p.featured_image === 'string' ? p.featured_image : (p.featured_image && p.featured_image.url) || '';
      if (src) { var img = el('img', 'cod__thumb'); img.src = sized(src, 120); img.alt = ''; img.width = 40; img.height = 50; img.loading = 'lazy'; a.appendChild(img); }
      a.appendChild(el('span', 'cod__line-title', p.title));
      a.appendChild(el('span', 'cod__line-price', money(cents(p.price))));
      li.appendChild(a);
      ul.appendChild(li);
    });
    box.hidden = false;
  }

  /* ---------- city + delivery promise ---------- */
  function cityChanged(ctx, quiet) {
    var input = ctx.form.elements.city;
    var info = HP.pkCityInfo ? HP.pkCityInfo(input.value) : { tier: 0 };
    var help = q(ctx, '[data-cod-eta]');
    if (!info.tier) { ctx.etaPlain = ''; if (help) help.textContent = ctx.cityHelp; return; }
    var eta = info.tier === 1 ? ctx.cfg.eta : ctx.t.etaOther;
    ctx.etaPlain = eta;
    var text = tpl(ctx.t.etaCity, { eta: eta, city: info.name });
    if (help) help.textContent = text;
    if (!quiet && ctx.mode === 'product') HP.emit('cod:city', { text: text, city: info.name, tier: info.tier });
  }

  /* ---------- validation ---------- */
  var validators = {
    name: function (v, t) { return v.trim().length >= 2 ? '' : t.errorName; },
    phone: function (v, t) { return normPhone(v) ? '' : t.errorPhone; },
    city: function (v, t) { return v.trim().length >= 2 ? '' : t.errorCity; },
    address: function (v, t) { return v.trim().length >= 10 ? '' : t.errorAddress; },
    email: function (v, t) { return !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : t.errorEmail; }
  };

  function setError(ctx, field, msg) {
    var wrap = ctx.form.querySelector('[data-field="' + field + '"]');
    if (!wrap) return false;
    var input = wrap.querySelector('input, textarea');
    wrap.classList.toggle('field--error', !!msg);
    if (input) { if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
    wrap.querySelector('[data-error]').textContent = msg || '';
    return true;
  }
  function clearErrors(ctx) {
    ctx.form.querySelectorAll('[data-field]').forEach(function (w) { setError(ctx, w.getAttribute('data-field'), ''); });
    hideError(ctx);
  }
  function validate(ctx, only) {
    var firstBad = null;
    Object.keys(validators).forEach(function (f) {
      if (only && only !== f) return;
      var msg = validators[f](ctx.form.elements[f].value, ctx.t);
      setError(ctx, f, msg);
      if (msg && !firstBad) firstBad = ctx.form.elements[f];
    });
    return firstBad;
  }
  function showError(ctx, msg, retry) {
    var box = q(ctx, '[data-cod-error]');
    q(ctx, '[data-cod-error-text]').textContent = msg;
    q(ctx, '[data-cod-retry]').hidden = !retry;
    box.hidden = false;
    if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: HP.prefersReducedMotion() ? 'auto' : 'smooth' });
  }
  function hideError(ctx) { var b = q(ctx, '[data-cod-error]'); if (b) b.hidden = true; }

  function setBusy(ctx, on) {
    ctx.busy = on;
    var btn = q(ctx, '[data-cod-submit]');
    btn.disabled = on || !!ctx.blocked;
    if (on) btn.setAttribute('aria-busy', 'true'); else btn.removeAttribute('aria-busy');
    btn.textContent = on ? ctx.t.submitting : ctx.t.submit;
  }

  /* ---------- submit ---------- */
  async function submit(ctx) {
    if (ctx.busy) return;
    hideError(ctx);
    var bad = validate(ctx);
    if (bad) { bad.focus(); return; }
    await refresh(ctx);
    if (ctx.blocked) return;

    var phone = normPhone(ctx.form.elements.phone.value);
    var sig = ctx.lines.map(function (l) { return l.variantId + 'x' + l.qty; }).join(',') + '|' + phone;
    var last = ssGet(LAST_KEY);
    if (last && last.sig === sig && Date.now() - last.t < 15 * 60 * 1000 && last.data) { success(ctx, last.data, true); return; }

    var payload = {
      lines: ctx.lines.map(function (l) { return { variantId: l.variantId, quantity: Math.min(50, l.qty) }; }),
      name: ctx.form.elements.name.value.trim(),
      phone: phone,
      city: ctx.form.elements.city.value.trim(),
      address: ctx.form.elements.address.value.trim(),
      note: ctx.form.elements.note.value.trim(),
      email: ctx.form.elements.email.value.trim(),
      source: ctx.source,
      website: ctx.form.elements.website.value,
      renderedAt: ctx.renderedAt,
      cartToken: ctx.mode === 'cart' ? (ctx.cartToken || '') : '',
      utm: ssGet(UTM_KEY) || {}
    };
    setBusy(ctx, true);
    var wait = MIN_RENDER_MS - (Date.now() - ctx.renderedAt);
    if (wait > 0) await new Promise(function (r) { setTimeout(r, wait); });

    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 25000) : 0;
    var res = null, data = null;
    try {
      res = await fetch(String(HP.settings.cod.proxyPath || '/apps/cod').replace(/\/$/, '') + '/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        signal: ctl ? ctl.signal : undefined
      });
      data = await res.json().catch(function () { return null; });
    } catch (e) { res = null; }
    clearTimeout(timer);
    setBusy(ctx, false);

    if (res && res.ok && data && data.ok) {
      ssSet(LAST_KEY, { sig: sig, t: Date.now(), data: data });
      success(ctx, data, false);
      return;
    }
    fail(ctx, res ? res.status : 0, data);
  }

  function fail(ctx, status, data) {
    var t = ctx.t;
    if (status === 422 && data && data.errors) {
      var general = '', firstBad = null;
      Object.keys(data.errors).forEach(function (f) {
        var local = validators[f] && validators[f](ctx.form.elements[f].value, t);
        if (!setError(ctx, f, local || data.errors[f])) general = general || data.errors[f];
        else if (!firstBad) firstBad = ctx.form.elements[f];
      });
      if (general) showError(ctx, general, false);
      if (firstBad) firstBad.focus();
      return;
    }
    if (status === 410 || (status === 409 && data && data.code === 'sold_out')) {
      var msg = t.errorSoldOut;
      var short = ((data && data.variants) || []).filter(function (v) { return v.reason === 'insufficient_stock' && v.available > 0; })[0];
      if (short) msg += ' ' + tpl(t.soldOutQty, { count: short.available });
      showError(ctx, msg, false);
      return;
    }
    if (status === 409) { showError(ctx, t.errorDuplicate, false); return; }
    if (status === 429) { showError(ctx, t.errorRate, false); return; }
    showError(ctx, t.errorGeneric, true);
  }

  /* ---------- success ---------- */
  function success(ctx, data, replay) {
    var t = ctx.t;
    var advance = data.status === 'advance_required';
    var eta = ctx.etaPlain || data.eta || ctx.cfg.eta;
    ctx.succeeded = true;
    ctx.form.hidden = true;
    var panel = q(ctx, '[data-cod-success]');
    panel.hidden = false;
    panel.scrollTop = 0;

    var title = q(ctx, '[data-cod-success-title]');
    title.textContent = advance ? t.advanceTitle : t.successTitle;
    q(ctx, '[data-cod-success-order]').textContent = tpl(t.orderLabel, { order: data.orderName || '' });
    q(ctx, '[data-cod-success-total]').textContent = data.total != null ? money(data.total) : '';
    var box = q(ctx, '[data-cod-advance]');
    box.hidden = !advance;
    var body = q(ctx, '[data-cod-success-body]');
    if (advance) {
      q(ctx, '[data-cod-advance-text]').textContent = (data.advance && data.advance.instructions) || t.advanceBody;
      body.textContent = '';
    } else {
      body.textContent = tpl(t.successBody, { eta: eta });
    }
    body.hidden = advance;

    var digits = String(ctx.cfg.whatsapp || '').replace(/\D/g, '');
    if (!digits && data.whatsapp) { var m = /wa\.me\/(\d+)/.exec(data.whatsapp); if (m) digits = m[1]; }
    var text = advance ? tpl(t.waReceiptText, { order: data.orderName || '' }) : tpl(t.waConfirmText, { order: data.orderName || '', total: plain(data.total || 0) });
    var wa = q(ctx, '[data-cod-wa]');
    wa.setAttribute('href', digits ? 'https://wa.me/' + digits + '?text=' + encodeURIComponent(text) : (data.whatsapp || '#'));
    q(ctx, '[data-cod-wa-label]').textContent = advance ? t.waReceipt : t.waConfirm;
    setTimeout(function () { title.focus(); }, 60);

    if (replay) return;
    if (ctx.mode === 'cart' && HP.cart && HP.cart.clear) HP.cart.clear().catch(function () { /* cart refresh failure is not an order failure */ });
    track(ctx, data);
  }

  function track(ctx, data) {
    var name = data.orderName;
    if (!name) return;
    var fired = ssGet(FIRED_KEY) || [];
    if (fired.indexOf(name) > -1) return;
    fired.push(name);
    ssSet(FIRED_KEY, fired.slice(-10));
    var value = (data.total || 0) / 100;
    var ids = ctx.lines.map(function (l) { return String(l.variantId); });
    var num = ctx.lines.reduce(function (n, l) { return n + l.qty; }, 0);
    var items = ctx.lines.map(function (l) {
      return { item_id: String(l.variantId), item_name: l.title, item_variant: l.variantTitle, price: l.price / 100, quantity: l.qty };
    });
    try {
      if (typeof window.fbq === 'function') {
        window.fbq('track', 'Purchase', { value: value, currency: 'PKR', content_ids: ids, content_type: 'product', num_items: num }, { eventID: name });
      }
    } catch (e) { /* analytics must never break checkout */ }
    try {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'purchase', { transaction_id: name, value: value, currency: 'PKR', items: items });
      }
    } catch (e) { /* ignore */ }
    try {
      (window.dataLayer = window.dataLayer || []).push({ event: 'hp_cod_order', transaction_id: name, value: value, currency: 'PKR', items: items, payment_type: 'cod' });
    } catch (e) { /* ignore */ }
  }

  /* ---------- delegated events ---------- */
  doc.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-cod-open]');
    if (trigger) { e.preventDefault(); open(trigger); return; }
    var retry = e.target.closest('[data-cod-retry]');
    if (retry) { var ctx = ctxOf(retry); if (ctx) submit(ctx); }
  });

  doc.addEventListener('submit', function (e) {
    var form = e.target.closest ? e.target.closest('[data-cod-form]') : null;
    if (!form) return;
    e.preventDefault();
    var ctx = ctxOf(form);
    if (ctx) submit(ctx);
  });

  var saveDraft = HP.debounce(function (ctx) {
    var draft = {};
    DRAFT_FIELDS.forEach(function (f) { draft[f] = ctx.form.elements[f].value; });
    ssSet(DRAFT_KEY, draft);
  }, 300);
  var cityDebounced = HP.debounce(function (ctx) { cityChanged(ctx); }, 250);

  doc.addEventListener('input', function (e) {
    var form = e.target.closest ? e.target.closest('[data-cod-form]') : null;
    if (!form) return;
    var ctx = ctxOf(form);
    if (!ctx) return;
    var wrap = e.target.closest('[data-field]');
    if (wrap && wrap.classList.contains('field--error')) setError(ctx, wrap.getAttribute('data-field'), '');
    if (e.target.name === 'city') cityDebounced(ctx);
    saveDraft(ctx);
  });

  doc.addEventListener('change', function (e) {
    if (e.target.name !== 'city') return;
    var ctx = ctxOf(e.target);
    if (ctx && e.target.closest('[data-cod-form]')) cityChanged(ctx);
  });

  doc.addEventListener('focusout', function (e) {
    var input = e.target;
    if (!input.closest || !input.closest('[data-cod-form]')) return;
    var ctx = ctxOf(input);
    if (!ctx || ctx.busy) return;
    var f = input.name;
    if (f === 'phone' && normPhone(input.value)) input.value = showPhone(normPhone(input.value));
    if (validators[f] && (input.value.trim() || input.getAttribute('aria-invalid'))) {
      // skip when focus is leaving to the close button so dismissing the sheet stays quiet
      var next = e.relatedTarget;
      if (next && next.closest && next.closest('[data-drawer-close]')) return;
      validate(ctx, f);
    }
  });

  HP.on('variant:change', function (d) {
    var ctx = d && ctxs['CodDrawer-' + d.sectionId];
    if (ctx && ctx.drawer && ctx.drawer.isOpen && !ctx.succeeded) refresh(ctx);
  });

  /* Opened from the cart drawer: that drawer is closed by hp-drawer when the sheet opens. Give it back on dismiss. */
  HP.on('drawer:close', function (d) {
    var ctx = d && ctxs[d.id];
    if (!ctx || !ctx.reopenCart || ctx.succeeded) return;
    ctx.reopenCart = false;
    setTimeout(function () { HP.openDrawer('CartDrawer'); }, 0);
  });
})();
