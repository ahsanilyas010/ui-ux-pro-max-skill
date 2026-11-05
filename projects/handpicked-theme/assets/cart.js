/* HandPicked — cart.js
   Shared by the cart drawer and the cart page (idempotent). Registers both sections for Section Rendering,
   re-renders them on hp:cart:updated, handles quantity / remove / undo / upsells and opens the drawer on add. */
(function () {
  'use strict';
  if (window.__hpCartInit) return;
  window.__hpCartInit = true;

  function boot() {
    var HP = window.HP;
    var doc = document;
    var UNDO_MS = 12000;
    var seq = 0;
    var queue = Promise.resolve();
    var qtyTimers = {};
    var pendingQty = {};
    var undo = null;
    var undoTimer = null;
    var recs = {};

    function roots() { return HP.qsa('[data-cart-root]'); }
    function str(key) {
      var r = roots();
      for (var i = 0; i < r.length; i++) { var v = r[i].getAttribute('data-str-' + key); if (v) return v; }
      return '';
    }
    function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function enqueue(fn) { var p = queue.then(fn); queue = p.catch(function () {}); return p; }
    function drawerEl() { return doc.getElementById('CartDrawer'); }
    function drawerOpen() { var d = drawerEl(); return !!(d && d.isOpen); }
    function findLine(key) {
      var lines = HP.qsa('[data-cart-line]');
      for (var i = 0; i < lines.length; i++) if (lines[i].getAttribute('data-line-key') === key) return lines[i];
      return null;
    }

    function registerSections() {
      var ids = roots().map(function (r) { return r.getAttribute('data-section-id'); }).filter(Boolean);
      if (ids.length) HP.cart.registerSections(ids);
    }

    /* ---------- Live region ---------- */
    function announce(text) {
      if (!text) return;
      var regions = HP.qsa('[data-cart-live]');
      var region = regions.filter(function (r) { return r.closest('.drawer.is-open'); })[0] ||
        regions.filter(function (r) { return !r.closest('hp-drawer'); })[0] || regions[0];
      if (!region) return;
      region.textContent = '';
      setTimeout(function () { region.textContent = text; }, 50);
    }

    /* ---------- Render ---------- */
    function sectionHTML(id, sections) {
      if (sections && sections[id]) return Promise.resolve(sections[id]);
      return HP.fetchSection(id);
    }

    function rememberFocus(root) {
      var a = doc.activeElement;
      if (!a || !root.contains(a)) return null;
      var line = a.closest('[data-cart-line]');
      var kind = null;
      if (a.matches('[data-cart-remove]')) kind = 'remove';
      else if (a.matches('.quantity__button')) kind = 'dir:' + a.getAttribute('data-dir');
      else if (a.matches('[data-cart-qty-input]')) kind = 'input';
      return { key: line && line.getAttribute('data-line-key'), kind: kind, id: a.id || '' };
    }

    function restoreFocus(root, memo) {
      if (!memo) return;
      var target = null;
      if (memo.key) {
        var line = findLine(memo.key);
        if (line) {
          if (memo.kind === 'remove') target = line.querySelector('[data-cart-remove]');
          else if (memo.kind && memo.kind.indexOf('dir:') === 0) target = line.querySelector('[data-dir="' + memo.kind.slice(4) + '"]');
          if (!target || target.disabled) target = line.querySelector('[data-cart-qty-input]');
        }
      } else if (memo.id) {
        target = doc.getElementById(memo.id);
      }
      if (!target) target = root.querySelector('[data-cart-undo]') || root.querySelector('.drawer__title, .cart-page__title, .empty-state a');
      if (target && target.focus) {
        if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }

    function applyRoot(root, html) {
      var fresh = HP.parseHTML(html);
      var id = root.getAttribute('data-section-id');
      var src = fresh.querySelector('[data-cart-root][data-section-id="' + id + '"]') || fresh.querySelector('[data-cart-root]');
      if (!src) return;
      var memo = rememberFocus(root);
      var oldSlot = root.querySelector('[data-cod-slot]');
      var keepSlot = oldSlot && oldSlot.childNodes.length ? oldSlot : null;
      if (keepSlot && keepSlot.parentNode) keepSlot.parentNode.removeChild(keepSlot);
      root.innerHTML = src.innerHTML;
      if (keepSlot) {
        var fresh_slot = root.querySelector('[data-cod-slot]');
        if (fresh_slot) fresh_slot.parentNode.replaceChild(keepSlot, fresh_slot);
      }
      postRender(root, memo);
    }

    function postRender(root, memo) {
      var drawer = root.closest('hp-drawer');
      var title = root.querySelector('.drawer__title');
      if (title) title.setAttribute('tabindex', '-1');
      if (drawer) {
        HP.qsa('[data-drawer-close]', root).forEach(function (b) { b.addEventListener('click', function () { drawer.close(); }); });
      }
      Object.keys(pendingQty).forEach(function (key) {
        var line = findLine(key);
        if (!line) return;
        var input = line.querySelector('[data-cart-qty-input]');
        if (input) { input.value = pendingQty[key]; }
        setBusy(line, true);
      });
      renderUndo(root);
      if (!(undo && undo.focusPending)) restoreFocus(root, memo);
      initUpsells(root);
      HP.emit('cart:rendered', { root: root, context: root.getAttribute('data-cart-context') });
    }

    function setBusy(line, on) {
      line.classList.toggle('is-updating', on);
      if (on) line.setAttribute('aria-busy', 'true'); else line.removeAttribute('aria-busy');
    }

    /* ---------- Undo after remove ---------- */
    function renderUndo(root) {
      var slot = root.querySelector('[data-cart-undo-slot]');
      if (!slot) return;
      slot.textContent = '';
      if (!undo || !undo.shown) return;
      var bar = doc.createElement('div');
      bar.className = 'cart-undo';
      bar.setAttribute('role', 'group');
      var text = doc.createElement('span');
      text.className = 'cart-undo__text';
      text.textContent = (str('removed') || 'Removed [title]').replace('[title]', undo.title);
      var btn = doc.createElement('button');
      btn.type = 'button';
      btn.className = 'button button--sm button--inverse';
      btn.setAttribute('data-cart-undo', '');
      btn.textContent = str('undo') || 'Undo';
      bar.appendChild(text);
      bar.appendChild(btn);
      slot.appendChild(bar);
      if (undo.focusPending && (!root.closest('hp-drawer') || drawerOpen())) {
        undo.focusPending = false;
        btn.focus({ preventScroll: true });
      }
    }
    function showUndo() {
      if (!undo) return;
      undo.shown = true;
      roots().forEach(renderUndo);
      armUndoTimer();
    }
    function armUndoTimer() {
      clearTimeout(undoTimer);
      undoTimer = setTimeout(clearUndo, UNDO_MS);
    }
    function clearUndo() {
      clearTimeout(undoTimer);
      var a = doc.activeElement;
      var hadFocus = !!(a && a.closest && a.closest('[data-cart-undo-slot]'));
      undo = null;
      roots().forEach(renderUndo);
      if (hadFocus) {
        var target = HP.qs('[data-cart-line] [data-cart-qty-input]', drawerOpen() ? drawerEl() : doc) || HP.qs(drawerOpen() ? '#CartDrawer .drawer__title' : '.cart-page__title');
        if (target) { if (!target.matches('input')) target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }
      }
    }
    doc.addEventListener('focusin', function (e) { if (undo && e.target.closest && e.target.closest('[data-cart-undo-slot]')) clearTimeout(undoTimer); });
    doc.addEventListener('focusout', function (e) {
      var slot = e.target.closest && e.target.closest('[data-cart-undo-slot]');
      if (undo && slot && !(e.relatedTarget && slot.contains(e.relatedTarget))) armUndoTimer();
    });
    doc.addEventListener('mouseover', function (e) { if (undo && e.target.closest && e.target.closest('[data-cart-undo-slot]')) clearTimeout(undoTimer); });
    doc.addEventListener('mouseout', function (e) {
      var slot = e.target.closest && e.target.closest('[data-cart-undo-slot]');
      if (undo && slot && !(e.relatedTarget && slot.contains(e.relatedTarget))) armUndoTimer();
    });

    /* ---------- Cart updated ---------- */
    function addedItem(d) {
      var a = d && d.added;
      if (!a) return null;
      return a.items ? a.items[a.items.length - 1] : a;
    }

    doc.addEventListener('hp:cart:updated', function (e) {
      var d = e.detail || {};
      refreshUpsellShells(d.cart);
      if (d.source === 'note') return;
      var mySeq = ++seq;
      var jobs = roots().map(function (root) {
        return sectionHTML(root.getAttribute('data-section-id'), d.sections).then(function (html) {
          if (mySeq === seq) applyRoot(root, html);
        });
      });
      Promise.all(jobs).catch(function () {}).then(function () {
        if (d.source === 'remove') showUndo();
        if (d.source === 'add') {
          var it = addedItem(d);
          if (HP.settings && HP.settings.cartType === 'drawer' && drawerEl()) {
            HP.openDrawer('CartDrawer');
          } else {
            HP.toast((HP.strings && HP.strings.added) || '', {
              image: it && (it.image || (it.featured_image && it.featured_image.url)),
              title: it ? esc(it.product_title || it.title || '') : '',
              actionLabel: str('view-cart') || 'View cart',
              actionHref: HP.routes.cart
            });
          }
        }
        if (d.source === 'remove') announce((str('removed') || '').replace('[title]', (undo && undo.title) || ''));
        else if (d.source === 'undo') announce(str('restored'));
        else if (d.source !== 'add') announce(str('updated'));
      });
    });

    /* ---------- Quantity ---------- */
    doc.addEventListener('hp:change', function (e) {
      var input = e.target;
      var line = input.closest && input.closest('[data-cart-line]');
      if (!line) return;
      var key = line.getAttribute('data-line-key');
      var qty = Number(input.value);
      pendingQty[key] = qty;
      setBusy(line, true);
      hideError(line);
      clearTimeout(qtyTimers[key]);
      qtyTimers[key] = setTimeout(function () {
        delete qtyTimers[key];
        enqueue(function () { return HP.cart.change(key, qty, { source: 'change' }); })
          .then(function () { delete pendingQty[key]; })
          .catch(function (err) { delete pendingQty[key]; qtyError(key, err); });
      }, 300);
    });

    function hideError(line) {
      var el = line.querySelector('[data-line-error]');
      if (el) { el.hidden = true; el.textContent = ''; }
    }
    function qtyError(key, err) {
      var line = findLine(key);
      var max = line && line.getAttribute('data-max');
      var msg = max && HP.strings && HP.strings.qtyError ? HP.strings.qtyError.replace('[count]', max) : ((err && err.message) || (HP.strings && HP.strings.cartError) || '');
      if (line) {
        setBusy(line, false);
        var input = line.querySelector('[data-cart-qty-input]');
        if (input) {
          input.value = line.getAttribute('data-qty');
          var q = input.closest('hp-quantity');
          if (q && q.sync) q.sync();
        }
        var el = line.querySelector('[data-line-error]');
        if (el) { el.textContent = msg; el.hidden = false; }
      }
      HP.toast(msg, { type: 'error' });
    }

    /* ---------- Remove / undo / note ---------- */
    doc.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-cart-remove]');
      if (rm) {
        e.preventDefault();
        var line = rm.closest('[data-cart-line]');
        if (!line) return;
        var key = line.getAttribute('data-line-key');
        clearTimeout(qtyTimers[key]); delete qtyTimers[key]; delete pendingQty[key];
        var props = null;
        try { props = JSON.parse(rm.getAttribute('data-properties') || 'null'); } catch (err) { props = null; }
        if (!props || Array.isArray(props) || !Object.keys(props).length) props = null;
        var input = line.querySelector('[data-cart-qty-input]');
        undo = { id: Number(rm.getAttribute('data-variant-id')), quantity: Number(input ? input.value : line.getAttribute('data-qty')) || 1, title: rm.getAttribute('data-title') || '', properties: props, focusPending: true, shown: false };
        setBusy(line, true);
        enqueue(function () { return HP.cart.change(key, 0, { source: 'remove' }); }).catch(function (err) {
          undo = null;
          var l = findLine(key);
          if (l) setBusy(l, false);
          HP.toast((err && err.message) || (HP.strings && HP.strings.cartError) || '', { type: 'error' });
        });
        return;
      }
      var ub = e.target.closest('[data-cart-undo]');
      if (ub && undo) {
        var u = undo;
        clearTimeout(undoTimer);
        undo = null;
        roots().forEach(renderUndo);
        var item = { id: u.id, quantity: u.quantity };
        if (u.properties) item.properties = u.properties;
        enqueue(function () { return HP.cart.add([item], { source: 'undo' }); }).catch(function (err) {
          HP.toast((err && err.message) || (HP.strings && HP.strings.cartError) || '', { type: 'error' });
        });
        return;
      }
      var add = e.target.closest('[data-upsell-add]');
      if (add && add.getAttribute('aria-busy') !== 'true') {
        var li = add.closest('[data-upsell-item]');
        var sel = li && li.querySelector('[data-upsell-variant]');
        var vid = Number(sel ? sel.value : add.getAttribute('data-variant-id'));
        if (!vid) return;
        add.setAttribute('aria-busy', 'true');
        enqueue(function () { return HP.cart.add([{ id: vid, quantity: 1 }], { source: 'upsell' }); })
          .catch(function (err) { HP.toast((err && err.message) || (HP.strings && HP.strings.cartError) || '', { type: 'error' }); })
          .then(function () { add.removeAttribute('aria-busy'); });
      }
    });

    doc.addEventListener('change', function (e) {
      var note = e.target.closest && e.target.closest('[data-cart-note]');
      if (!note) return;
      enqueue(function () { return HP.cart.update({ note: note.value }, { source: 'note', sections: [] }); }).catch(function () {});
    });

    /* ---------- Upsells + free-delivery add-on ---------- */
    function drawerSectionId() {
      var d = drawerEl();
      return d ? d.getAttribute('data-section-id') : '';
    }
    function fetchRecs(pid) {
      if (recs[pid]) return recs[pid].promise;
      var sid = drawerSectionId();
      function load(intent) {
        var url = HP.routes.productRecommendations + '?product_id=' + encodeURIComponent(pid) + '&limit=8&intent=' + intent + '&section_id=' + encodeURIComponent(sid);
        return fetch(url, { headers: { Accept: 'text/html' } }).then(function (r) {
          if (!r.ok) throw new Error('recs ' + r.status);
          return r.text();
        }).then(function (html) {
          var node = HP.parseHTML(html).querySelector('[data-upsell-content]');
          return node ? node.innerHTML : '';
        });
      }
      var entry = recs[pid] = { html: null };
      entry.promise = load('complementary').then(function (h) { return h || load('related'); }).catch(function () { return ''; }).then(function (h) { entry.html = h; return h; });
      return entry.promise;
    }

    function applyUpsells(shell, html) {
      var slot = shell.querySelector('[data-upsell-slot]');
      if (!slot) return;
      slot.innerHTML = html || '';
      var inCart = (shell.getAttribute('data-in-cart') || '').split(',').filter(Boolean);
      var limit = Number(shell.getAttribute('data-limit')) || 4;
      var remaining = Number(shell.getAttribute('data-remaining')) || 0;
      var items = HP.qsa('[data-upsell-item]', slot);
      items.forEach(function (li) { if (inCart.indexOf(li.getAttribute('data-product-id')) > -1) li.parentNode.removeChild(li); });
      items = HP.qsa('[data-upsell-item]', slot);
      var addon = false;
      var keep = items;
      if (remaining > 0) {
        var enough = items.filter(function (li) { return Number(li.getAttribute('data-price')) >= remaining; })
          .sort(function (a, b) { return Number(a.getAttribute('data-price')) - Number(b.getAttribute('data-price')); });
        if (enough.length) { addon = true; keep = enough; if (keep.length > limit) keep = keep.slice(0, limit); }
      }
      if (!addon) keep = items.slice(0, limit);
      var ul = slot.querySelector('ul');
      items.forEach(function (li) { if (keep.indexOf(li) < 0) li.parentNode.removeChild(li); });
      if (ul && addon) keep.forEach(function (li) { ul.appendChild(li); });
      var title = shell.querySelector('[data-upsell-title]');
      var hint = shell.querySelector('[data-upsell-hint]');
      if (title) title.textContent = addon ? shell.getAttribute('data-title-addon') : shell.getAttribute('data-title-default');
      if (hint) { hint.textContent = addon ? shell.getAttribute('data-hint-addon') : ''; hint.hidden = !addon; }
      shell.hidden = keep.length === 0;
    }

    function loadUpsells(shell) {
      var pid = shell.getAttribute('data-product-id');
      if (!pid) { shell.hidden = true; return; }
      if (shell.closest('hp-drawer') && !drawerOpen()) return;
      if (recs[pid] && recs[pid].html !== null) { applyUpsells(shell, recs[pid].html); return; }
      fetchRecs(pid).then(function (html) { if (shell.isConnected) applyUpsells(shell, html); });
    }
    function initUpsells(scope) {
      HP.qsa('[data-cart-upsells]', scope || doc).forEach(loadUpsells);
    }
    function refreshUpsellShells(cart) {
      if (!cart) return;
      var threshold = ((HP.settings && HP.settings.shipping && HP.settings.shipping.freeThreshold) || 0) * 100;
      var remaining = Math.max(0, threshold - cart.total_price);
      var ids = cart.items.map(function (i) { return i.product_id; });
      HP.qsa('[data-cart-upsells][data-context="page"]').forEach(function (shell) {
        var first = ids.length ? String(ids[0]) : '';
        shell.setAttribute('data-in-cart', ids.join(',') + ',');
        shell.setAttribute('data-remaining', String(remaining));
        if (first !== shell.getAttribute('data-product-id')) { shell.setAttribute('data-product-id', first); }
        if (!first) { shell.hidden = true; return; }
        loadUpsells(shell);
      });
    }

    doc.addEventListener('hp:drawer:open', function (e) {
      if (e.detail && e.detail.id === 'CartDrawer') initUpsells(drawerEl());
    });
    doc.addEventListener('hp:section:load', function () { registerSections(); initUpsells(); });

    registerSections();
    initUpsells();
  }

  if (window.HP && window.HP.cart) boot();
  else document.addEventListener('DOMContentLoaded', function () { if (window.HP && window.HP.cart) boot(); }, { once: true });
})();
