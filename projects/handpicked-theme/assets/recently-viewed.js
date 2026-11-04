/* HandPicked Editorial — recently-viewed.js
   Keeps up to 12 viewed product handles in localStorage ('hp:recently-viewed'), renders them through
   Section Rendering on /search (handle: queries), preserves recency order, excludes the current product
   and hides itself when fewer than 2 items remain. */
(function () {
  'use strict';
  const HP = (window.HP = window.HP || {});
  const KEY = 'hp:recently-viewed';
  const MAX_STORED = 12;
  const bound = new WeakSet();

  function read() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((h) => typeof h === 'string') : []; } catch (e) { return []; }
  }
  function write(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_STORED))); } catch (e) { /* storage blocked */ } }

  function remember(handle) {
    if (!handle) return;
    const list = read().filter((h) => h !== handle);
    list.unshift(handle);
    write(list);
  }

  async function render(section) {
    const current = section.getAttribute('data-current-handle');
    const max = Number(section.getAttribute('data-max')) || 8;
    const handles = read().filter((h) => h !== current).slice(0, MAX_STORED);
    if (handles.length < 2) return;
    const sectionId = section.getAttribute('data-section-id');
    const base = section.getAttribute('data-search-url') || (HP.routes && HP.routes.search) || '/search';
    const query = handles.map((h) => 'handle:' + h).join(' OR ');
    try {
      const url = base + '?q=' + encodeURIComponent(query) + '&type=product&section_id=' + encodeURIComponent(sectionId);
      const res = await fetch(url, { headers: { Accept: 'text/html' } });
      if (!res.ok) return;
      const doc = HP.parseHTML(await res.text());
      const items = Array.from(doc.querySelectorAll('[data-recent-list] > [data-handle]'))
        .filter((li) => li.getAttribute('data-handle') !== current);
      items.sort((a, b) => handles.indexOf(a.getAttribute('data-handle')) - handles.indexOf(b.getAttribute('data-handle')));
      const shown = items.slice(0, max);
      if (shown.length < 2) return;
      const list = section.querySelector('[data-recent-list]');
      list.innerHTML = '';
      shown.forEach((li) => list.appendChild(document.importNode(li, true)));
      section.hidden = false;
    } catch (e) { /* stay hidden */ }
  }

  function init(section) {
    if (bound.has(section)) return;
    bound.add(section);
    const current = section.getAttribute('data-current-handle');
    const handlesBefore = read().filter((h) => h !== current);
    remember(current);
    if (handlesBefore.length < 2) return;
    if ('IntersectionObserver' in window) {
      const sentinel = document.createElement('div');
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.cssText = 'height:1px;';
      section.parentNode.insertBefore(sentinel, section);
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { io.disconnect(); render(section); }
      }, { rootMargin: '600px 0px' });
      io.observe(sentinel);
    } else {
      render(section);
    }
  }

  function boot() {
    document.querySelectorAll('[data-recently-viewed]').forEach(init);
    HP.on('section:load', ({ target }) => { if (target) target.querySelectorAll('[data-recently-viewed]').forEach(init); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
