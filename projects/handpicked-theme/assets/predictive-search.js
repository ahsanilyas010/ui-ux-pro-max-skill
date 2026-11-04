/* HandPicked — predictive-search.js
   Search drawer: debounced (300ms) predictive search via the Section Rendering API, stale requests aborted,
   up/down keyboard navigation through role="option" links (focus stays in the input via aria-activedescendant). */
(function () {
  'use strict';
  var started = false;

  function start() {
    if (started) return;
    var HP = window.HP;
    var root = document.querySelector('[data-predictive-search]');
    if (!HP || !root) return;
    started = true;

    var input = root.querySelector('[data-ps-input]');
    var form = root.querySelector('[data-ps-form]');
    var clear = root.querySelector('[data-ps-clear]');
    var results = root.querySelector('[data-ps-results]');
    var suggest = root.querySelector('[data-ps-suggest]');
    var status = root.querySelector('[data-ps-status]');
    var skeleton = root.querySelector('template[data-ps-skeleton]');
    var footer = document.querySelector('[data-ps-footer]');
    var allLink = document.querySelector('[data-ps-all]');
    var sectionName = root.getAttribute('data-section') || 'predictive-search';
    var cache = new Map();
    var controller = null;
    var active = -1;

    function options() { return Array.prototype.slice.call(results.querySelectorAll('[role="option"]')); }

    function setActive(index) {
      var list = options();
      list.forEach(function (o) { o.removeAttribute('aria-selected'); });
      active = index;
      if (index < 0 || !list[index]) { input.removeAttribute('aria-activedescendant'); return; }
      list[index].setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', list[index].id);
      list[index].scrollIntoView({ block: 'nearest' });
    }

    function reset() {
      if (controller) controller.abort();
      active = -1;
      results.hidden = true;
      results.innerHTML = '';
      suggest.hidden = false;
      if (footer) footer.hidden = true;
      clear.hidden = !input.value;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      status.textContent = '';
    }

    function show(html, count, query) {
      results.innerHTML = html;
      results.hidden = false;
      suggest.hidden = true;
      input.setAttribute('aria-expanded', count > 0 ? 'true' : 'false');
      active = -1;
      if (footer && allLink) {
        footer.hidden = false;
        allLink.href = HP.routes.search + '?q=' + encodeURIComponent(query) + '&options[prefix]=last';
      }
      var text = count === 1 ? root.getAttribute('data-count-one') : (root.getAttribute('data-count-many') || '').replace('[count]', String(count));
      status.textContent = count > 0 ? text : '';
    }

    function showMessage(message) {
      var p = document.createElement('p');
      p.className = 'predictive__empty text-sm u-text-muted';
      p.textContent = message;
      results.innerHTML = '';
      results.appendChild(p);
      results.hidden = false;
      suggest.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      if (footer) footer.hidden = true;
    }

    function search(query) {
      if (cache.has(query)) { var hit = cache.get(query); show(hit.html, hit.count, query); return; }
      if (controller) controller.abort();
      controller = typeof AbortController === 'function' ? new AbortController() : null;
      if (skeleton) { results.innerHTML = skeleton.innerHTML; results.hidden = false; suggest.hidden = true; }
      var url = HP.routes.predictiveSearch + '?q=' + encodeURIComponent(query) +
        '&resources[type]=product,collection,page,article&resources[limit]=6&resources[limit_scope]=each' +
        '&resources[options][fields]=title,product_type,variants.title,vendor&section_id=' + sectionName;
      fetch(url, { headers: { Accept: 'text/html' }, signal: controller ? controller.signal : undefined })
        .then(function (res) { if (!res.ok) throw new Error('predictive ' + res.status); return res.text(); })
        .then(function (text) {
          var node = HP.parseHTML(text).querySelector('[data-predictive-results]');
          if (!node) { showMessage(root.getAttribute('data-error') || ''); return; }
          var count = Number(node.getAttribute('data-ps-count')) || 0;
          cache.set(query, { html: node.innerHTML, count: count });
          show(node.innerHTML, count, query);
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          showMessage(root.getAttribute('data-error') || '');
        });
    }

    var onInput = HP.debounce(function () {
      var q = input.value.trim();
      if (!q) { reset(); return; }
      search(q);
    }, 300);

    input.addEventListener('input', function () { clear.hidden = !input.value; onInput(); });

    input.addEventListener('keydown', function (e) {
      var list = options();
      if (e.key === 'ArrowDown' && list.length) { e.preventDefault(); setActive(active + 1 >= list.length ? 0 : active + 1); }
      else if (e.key === 'ArrowUp' && list.length) { e.preventDefault(); setActive(active <= 0 ? list.length - 1 : active - 1); }
      else if (e.key === 'Enter' && active >= 0 && list[active]) { e.preventDefault(); window.location.assign(list[active].href); }
      else if (e.key === 'Escape' && !results.hidden) { e.preventDefault(); e.stopPropagation(); input.value = ''; reset(); }
    });

    clear.addEventListener('click', function () { input.value = ''; reset(); input.focus(); });
    form.addEventListener('submit', function () { if (controller) controller.abort(); });

    results.addEventListener('mousemove', function (e) {
      var opt = e.target.closest('[role="option"]');
      if (!opt) return;
      var i = options().indexOf(opt);
      if (i !== active) setActive(i);
    });
  }

  if (window.HP && window.HP.cart) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
