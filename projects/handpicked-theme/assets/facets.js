/* HandPicked — facets.js
   Live filtering + sorting for the collection and search pages.
   Any change on #FacetsForm (or a control attached to it with form="FacetsForm") re-fetches the section and swaps every
   [data-facets-part] node (grid, pager, active chips, counts, filter groups). Falls back to a full page load on any error. */
(function () {
  'use strict';
  var started = false;

  function start() {
    if (started) return;
    var HP = window.HP;
    var section = document.querySelector('[data-facets-section]');
    var formEl = document.getElementById('FacetsForm');
    if (!HP || !section || !formEl) return;
    started = true;

    var sectionId = section.getAttribute('data-facets-section');
    var controller = null;

    function parts(root, name) { return Array.prototype.slice.call(root.querySelectorAll('[data-facets-part="' + name + '"]')); }

    function buildUrl() {
      var params = new URLSearchParams();
      new FormData(formEl).forEach(function (value, key) {
        if (value === '' || value === null) return;
        params.append(key, value);
      });
      var action = formEl.getAttribute('action') || window.location.pathname;
      var qs = params.toString();
      return action + (qs ? '?' + qs : '');
    }

    function showSkeleton() {
      var tpl = section.querySelector('template[data-facets-skeleton]');
      parts(document, 'grid').forEach(function (grid) {
        grid.setAttribute('aria-busy', 'true');
        if (tpl) grid.innerHTML = '<ul class="product-grid" role="list">' + tpl.innerHTML + '</ul>';
      });
    }

    function swapParts(fresh) {
      var names = ['filter-badge', 'count', 'active', 'groups', 'apply-label', 'footer-clear', 'grid', 'pager'];
      var activeEl = document.activeElement;
      var focusKey = null;
      if (activeEl && formEl.contains(activeEl) && activeEl.name) {
        focusKey = { name: activeEl.name, value: activeEl.value, id: activeEl.id };
      }
      var openState = Array.prototype.map.call(formEl.querySelectorAll('details.facets-group'), function (d) { return d.open; });
      var bodies = parts(document, 'groups');
      var scrollTop = bodies[0] ? bodies[0].scrollTop : 0;

      names.forEach(function (name) {
        var current = parts(document, name);
        var next = parts(fresh, name);
        current.forEach(function (node, i) {
          if (next[i]) node.innerHTML = next[i].innerHTML;
          node.removeAttribute('aria-busy');
        });
      });

      Array.prototype.forEach.call(formEl.querySelectorAll('details.facets-group'), function (d, i) {
        if (openState[i] === false) d.open = false;
      });
      var newBody = parts(document, 'groups')[0];
      if (newBody) newBody.scrollTop = scrollTop;

      if (focusKey) {
        var target = focusKey.id ? document.getElementById(focusKey.id) : null;
        if (!target) {
          var candidates = formEl.querySelectorAll('[name="' + focusKey.name.replace(/"/g, '\\"') + '"]');
          Array.prototype.some.call(candidates, function (c) { if (c.value === focusKey.value) { target = c; return true; } return false; });
        }
        if (target && target.focus) target.focus({ preventScroll: true });
      }
    }

    function syncSelectFromUrl(url) {
      var sort = document.getElementById('FacetsSort');
      if (!sort) return;
      var wanted = new URL(url, window.location.origin).searchParams.get('sort_by');
      if (wanted) sort.value = wanted;
    }

    function update(url, mode) {
      if (controller) controller.abort();
      controller = typeof AbortController === 'function' ? new AbortController() : null;
      var mine = controller;
      showSkeleton();
      var u = new URL(url, window.location.origin);
      u.searchParams.set('section_id', sectionId);
      fetch(u.toString(), { headers: { Accept: 'text/html' }, signal: mine ? mine.signal : undefined })
        .then(function (res) { if (!res.ok) throw new Error('facets ' + res.status); return res.text(); })
        .then(function (html) {
          var fresh = HP.parseHTML(html);
          swapParts(fresh);
          if (mode !== 'pop') window.history.pushState({ facets: true }, '', url);
          syncSelectFromUrl(url);
          HP.emit('facets:updated', { url: url, sectionId: sectionId });
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          window.location.assign(url);
        });
    }

    var run = HP.debounce(function () { update(buildUrl()); }, 250);

    function isFormControl(el) { return el && el.form && el.form.id === 'FacetsForm'; }

    document.addEventListener('change', function (e) { if (isFormControl(e.target)) run(); });
    formEl.addEventListener('submit', function (e) { e.preventDefault(); update(buildUrl()); });

    document.addEventListener('click', function (e) {
      var more = e.target.closest('[data-facets-more]');
      if (more) {
        var list = more.previousElementSibling;
        if (list) {
          var expanded = list.classList.toggle('is-expanded');
          more.setAttribute('aria-expanded', String(expanded));
          more.textContent = expanded ? more.getAttribute('data-label-less') : more.getAttribute('data-label-more');
        }
        return;
      }
      var link = e.target.closest('.active-filters a, [data-facets-clear]');
      if (link && link.href && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        var next = new URL(link.href);
        update(next.pathname + next.search);
      }
    });

    window.addEventListener('popstate', function () {
      update(window.location.pathname + window.location.search, 'pop');
    });
  }

  if (window.HP && window.HP.cart) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
