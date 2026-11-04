/* HandPicked — load-more.js
   Appends the next page of cards to the grid (no full reload), keeps ?page= in the URL, announces the result.
   Auto-loads the first two extra pages when the button scrolls into view, then falls back to the manual button. */
(function () {
  'use strict';
  var started = false;

  function start() {
    if (started) return;
    var HP = window.HP;
    var section = document.querySelector('[data-facets-section]');
    if (!HP || !section) return;
    started = true;

    var sectionId = section.getAttribute('data-facets-section');
    var autoLoaded = 0;
    var loading = false;
    var observer = null;
    var live = document.createElement('div');
    live.className = 'visually-hidden';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);

    function pager() { return section.querySelector('[data-facets-part="pager"]'); }
    function button() { return section.querySelector('[data-load-more-button]'); }

    function watch() {
      if (observer) observer.disconnect();
      var btn = button();
      var saveData = navigator.connection && navigator.connection.saveData;
      if (!btn || autoLoaded >= 2 || saveData || !('IntersectionObserver' in window)) return;
      observer = new IntersectionObserver(function (entries) {
        if (entries.some(function (en) { return en.isIntersecting; })) next(btn, true);
      }, { rootMargin: '400px 0px' });
      observer.observe(btn);
    }

    function next(btn, auto) {
      if (loading || !btn || !btn.href) return;
      loading = true;
      btn.setAttribute('aria-busy', 'true');
      var url = btn.getAttribute('href');
      HP.fetchSection(sectionId, url)
        .then(function (html) {
          var fresh = HP.parseHTML(html);
          var grid = section.querySelector('[data-product-grid]');
          var incoming = fresh.querySelector('[data-facets-part="grid"] [data-product-grid]');
          if (!grid || !incoming) throw new Error('load-more: no grid');
          var added = Array.prototype.map.call(incoming.children, function (n) { return document.importNode(n, true); });
          added.forEach(function (n) { grid.appendChild(n); });
          var freshPager = fresh.querySelector('[data-facets-part="pager"]');
          var currentPager = pager();
          if (currentPager && freshPager) currentPager.innerHTML = freshPager.innerHTML;
          try { window.history.replaceState(window.history.state, '', url); } catch (e) { /* ignore */ }
          var template = btn.getAttribute('data-label-loaded') || '';
          live.textContent = template.replace('[count]', String(added.length));
          if (auto) autoLoaded += 1;
          else {
            var firstLink = added[0] && added[0].querySelector('a');
            if (firstLink) firstLink.focus({ preventScroll: false });
          }
          HP.emit('section:replaced', { sectionId: sectionId, target: grid });
        })
        .catch(function () {
          var msg = btn.getAttribute('data-label-error');
          if (msg) HP.toast(msg, { type: 'error' });
          btn.removeAttribute('aria-busy');
          autoLoaded = 2;
        })
        .then(function () { loading = false; watch(); });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-load-more-button]');
      if (!btn || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      next(btn, false);
    });

    HP.on('facets:updated', function () { autoLoaded = 0; watch(); });
    watch();
  }

  if (window.HP && window.HP.cart) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
