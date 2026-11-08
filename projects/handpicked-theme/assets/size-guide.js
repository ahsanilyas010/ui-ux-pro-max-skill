/* HandPicked Editorial — size-guide.js
   Moves the size-guide drawer to <body> (so the page can be made inert while it is open), makes tables
   scroll horizontally, and adds a cm / inch switch. The first column and size-code columns
   (Size, EU, UK, US…) are never converted. data-unit on the drawer states the unit the tables are written in. */
(function () {
  'use strict';
  const bound = new WeakSet();
  const SKIP_HEADER = /size|eu|uk|us|sku|code|waist size|age/i;
  const NUM = /\d+(?:[.,]\d+)?/g;

  function convert(value, to) {
    const n = parseFloat(String(value).replace(',', '.'));
    if (isNaN(n)) return value;
    return to === 'cm' ? String(Math.round(n * 2.54 * 10) / 10).replace(/\.0$/, '') : String(Math.round((n / 2.54) * 4) / 4).replace(/\.0$/, '');
  }

  function init(drawer) {
    if (bound.has(drawer)) return;
    bound.add(drawer);
    const id = drawer.id;
    const stale = document.body.querySelector(':scope > #' + id);
    if (stale && stale !== drawer) stale.remove();
    document.body.appendChild(drawer);

    const content = drawer.querySelector('[data-size-guide-content]');
    const toggle = drawer.querySelector('[data-unit-toggle]');
    if (!content) return;
    const base = drawer.getAttribute('data-unit') === 'cm' ? 'cm' : 'in';
    const cells = [];

    content.querySelectorAll('table').forEach((table) => {
      if (!table.parentElement.classList.contains('table-wrap')) {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
      const rows = Array.from(table.rows);
      if (!rows.length) return;
      const headerRow = rows[0];
      const skip = Array.from(headerRow.cells).map((c, i) => i === 0 || SKIP_HEADER.test(c.textContent.trim()));
      rows.slice(1).forEach((row) => {
        Array.from(row.cells).forEach((cell, i) => {
          if (skip[i]) return;
          const text = cell.textContent.trim();
          if (/^\d+(?:[.,]\d+)?(?:\s*[-–—/]\s*\d+(?:[.,]\d+)?)?$/.test(text)) {
            cell.dataset.orig = text;
            cells.push(cell);
          }
        });
      });
    });

    if (!cells.length || !toggle) return;
    toggle.hidden = false;
    const buttons = Array.from(toggle.querySelectorAll('[data-unit-set]'));
    const setUnit = (unit) => {
      cells.forEach((cell) => {
        const orig = cell.dataset.orig;
        cell.textContent = unit === base ? orig : orig.replace(NUM, (m) => convert(m, unit));
      });
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.getAttribute('data-unit-set') === unit)));
    };
    buttons.forEach((b) => b.addEventListener('click', () => setUnit(b.getAttribute('data-unit-set'))));
    setUnit(base);
  }

  function boot() { document.querySelectorAll('[data-size-guide]').forEach(init); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
