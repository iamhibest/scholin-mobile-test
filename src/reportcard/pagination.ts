// @ts-nocheck
/* Report card A4 pagination, ported from the HTML app (js-report-card-pagination.js).
   Runs inside the WebView and inside the PDF converter so both show identical pages. */

export const PAGINATION_JS = String.raw`/* =========================================================
   Scholin — Report card A4 pagination
   =========================================================
   Problem: a report card with many subjects is taller than one A4 page,
   and the PDF export used to slice the picture wherever the page ended,
   which could cut through a row or through the remarks.

   What this does, AFTER a card has been drawn on the page:

     1. If the card already fits one A4 page  ->  NOTHING changes.
        (Small report cards look exactly as they always did.)

     2. If it is too tall, first tighten the SUBJECT ROWS only (smaller
        row padding and text), a little at a time, using the mildest
        setting that makes everything fit on one page.

     3. If it still does not fit at the tightest setting, keep as many
        subjects as fit on page 1 and move ONLY the leftover subject rows
        to page 2 (and 3, 4... if ever needed), each with the table
        heading repeated on top.

   Everything else — the school header, student details, summary boxes,
   traits, remarks, signatures, "promoted to" — is never moved. It always
   stays on page 1.

   Nothing here changes what a report card SAYS. It only decides how many
   subject rows sit on which page and how tightly they are drawn.

   USAGE (from a page that shows a report card):
       ReportCardPagination.mount(container, html, onRelayout)
   replaces  container.innerHTML = html.  It draws the card, paginates it,
   and (once web fonts have finished loading, which can change heights)
   re-checks itself and calls onRelayout() if anything changed.
   ========================================================= */

(function () {
  'use strict';

  var A4_RATIO = 297 / 210;      // A4 height / width
  var SAFETY_PX = 8;             // headroom so a late font change can't push a page over
  var MAX_PAGES = 6;             // hard stop; a class this large needs a different design
  var MIN_ROWS_PAGE1 = 3;        // if fewer than this fit beside the fixed blocks, don't paginate

  // Only templates listed here are paginated. Any other template is left
  // exactly as it was. (Classic first; the others are added once each has
  // been checked.)
  var config = { maxRowsPage1: 20, enabled: ['classic', 'modern', 'royal', 'british', 'prestige', 'minimal', 'primary', 'monochrome'] };

  // Two things are tightened together, mildest step first:
  //   rows  - the SUBJECT ROWS: padding, text size and line height, as a
  //           fraction of that template's own values.
  //   space - everything ELSE on the card (header, bio table, summary boxes,
  //           remarks...): the vertical gaps and padding around and inside
  //           those blocks, and the line spacing of their text. Their text
  //           SIZE is deliberately left alone, so nothing else gets harder
  //           to read; it is only packed closer together.
  // The tightest step is about 2px row padding and 0.6rem row text on Classic.
  var LEVELS = [
    { pad: 0.70, font: 0.95, line: 1.35,  space: 0.85, cardLine: 1.40 },
    { pad: 0.57, font: 0.90, line: 1.25,  space: 0.70, cardLine: 1.30 },
    { pad: 0.43, font: 0.85, line: 1.20,  space: 0.55, cardLine: 1.22 },
    { pad: 0.29, font: 0.79, line: 1.15,  space: 0.40, cardLine: 1.15 }
  ];

  function templateKeyOf(card) {
    var m = /(?:^|\s)rc-tpl-([a-z0-9]+)/.exec(card.className || '');
    return m ? m[1] : null;
  }

  function pxNum(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  /** All report-card pages that were drawn side by side in the same container, in order. */
  function pagesOf(el) {
    if (!el) return [];
    var parent = el.parentElement;
    if (!parent) return [el];
    var pages = [];
    for (var i = 0; i < parent.children.length; i++) {
      var c = parent.children[i];
      if (c.classList && c.classList.contains('rc-page')) pages.push(c);
    }
    return pages.length ? pages : [el];
  }

  /** Make a page at least one full A4 sheet tall (so each PDF page is filled). */
  function stretchToSheet(card, pageH) {
    var cs = window.getComputedStyle(card);
    var vert = pxNum(cs.paddingTop) + pxNum(cs.paddingBottom) + pxNum(cs.borderTopWidth) + pxNum(cs.borderBottomWidth);
    var target = cs.boxSizing === 'border-box' ? pageH : pageH - vert;
    card.style.minHeight = Math.max(0, target) + 'px';
  }

  /** Every element on the card (except the card itself and the subjects table) that has vertical margin or padding. */
  function collectSpacing(card, table) {
    var list = [];
    var all = card.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (table.contains(el)) continue;
      var cs = window.getComputedStyle(el);
      var b = { el: el, mt: pxNum(cs.marginTop), mb: pxNum(cs.marginBottom), pt: pxNum(cs.paddingTop), pb: pxNum(cs.paddingBottom) };
      if (b.mt > 0 || b.mb > 0 || b.pt > 0 || b.pb > 0) list.push(b);
    }
    return list;
  }

  function applySpacing(card, list, level) {
    card.style.lineHeight = String(level.cardLine);
    var f = level.space;
    for (var i = 0; i < list.length; i++) {
      var b = list[i], s = b.el.style;
      if (b.mt > 0) s.marginTop = (b.mt * f).toFixed(2) + 'px';
      if (b.mb > 0) s.marginBottom = (b.mb * f).toFixed(2) + 'px';
      if (b.pt > 0) s.paddingTop = (b.pt * f).toFixed(2) + 'px';
      if (b.pb > 0) s.paddingBottom = (b.pb * f).toFixed(2) + 'px';
    }
  }

  // Never let a score column get narrower than this (px) when the name column is widened.
  var MIN_OTHER_COL_PX = 52;
  // The name column may take at most this share of the table width.
  var MAX_NAME_COL = 0.30;

  /**
   * The subjects table shares its width equally between all columns, so the
   * subject-NAME column is only as wide as a score column and long names
   * ("Agricultural Science") wrap onto two lines. A wrapped row is twice as
   * tall, which is what limits how many subjects fit on a page.
   *
   * This widens the name column, but only as far as the longest subject name
   * needs (capped), and keeps the change ONLY if it really makes the card
   * shorter. If nothing wraps, or widening would not help, the table is left
   * with equal columns exactly as before. The width lives on the first header
   * cell, so continuation pages (copies of this table) inherit it.
   * Returns true when a wider column was kept.
   */
  function fitNameColumn(card, table) {
    var heads = table.querySelectorAll('thead tr th');
    var head = heads[0];
    if (!head) return false;

    var autoLayout = window.getComputedStyle(table).tableLayout !== 'fixed';
    var i;
    for (i = 0; i < heads.length; i++) heads[i].style.width = '';   // start from the template's own widths
    table.style.width = '';
    if (autoLayout) table.style.tableLayout = '';

    var names = table.querySelectorAll('tbody td.rc2-subject-name');
    if (!names.length) return false;
    var cols = heads.length;
    var tableW = table.offsetWidth;
    if (cols < 3 || !tableW) return false;

    var before = card.offsetHeight;

    // Natural single-line width of the longest name, measured with real fonts.
    for (i = 0; i < names.length; i++) names[i].style.whiteSpace = 'nowrap';
    var need = 0;
    for (i = 0; i < names.length; i++) need = Math.max(need, names[i].scrollWidth);
    for (i = 0; i < names.length; i++) names[i].style.whiteSpace = '';

    var cs = window.getComputedStyle(names[0]);
    need += pxNum(cs.paddingRight) + 2;                      // right padding + borders

    // The width every OTHER column currently has, measured before any change,
    // so a continuation page (which may hold fewer or shorter rows) is pinned
    // to the SAME widths as page 1 instead of an auto-layout table recomputing
    // its own columns from whatever text that page happens to contain.
    var colPx = [];
    for (i = 0; i < heads.length; i++) colPx.push(heads[i].getBoundingClientRect().width);
    var equal = colPx[0];

    if (need <= equal + 1) {
      // Names already fit: still pin the measured widths on an auto-layout
      // table, so a continuation page can't drift from page 1 on its own.
      if (autoLayout) { table.style.tableLayout = 'fixed'; table.style.width = tableW + 'px'; for (i = 0; i < heads.length; i++) heads[i].style.width = colPx[i] + 'px'; }
      return false;
    }

    var target = Math.min(need + 3, tableW * MAX_NAME_COL);
    var minOthers = MIN_OTHER_COL_PX * (cols - 1);
    if (target > tableW - minOthers) target = tableW - minOthers;
    if (target <= equal + 1) {
      if (autoLayout) { table.style.tableLayout = 'fixed'; table.style.width = tableW + 'px'; for (i = 0; i < heads.length; i++) heads[i].style.width = colPx[i] + 'px'; }
      return false;
    }

    // Give the name column the extra space; share what is left equally
    // among the other columns (their widths may shrink a little).
    var otherTotal = tableW - colPx[0];
    var newOtherTotal = tableW - target;
    var shrink = otherTotal > 0 ? newOtherTotal / otherTotal : 1;

    table.style.tableLayout = 'fixed';
    table.style.width = tableW + 'px';
    head.style.width = target + 'px';
    for (i = 1; i < heads.length; i++) heads[i].style.width = (colPx[i] * shrink) + 'px';

    if (card.offsetHeight < before) return true;             // it helped: keep it

    // Widening the name column did not shrink the card: undo the WIDTH change,
    // but still PIN every column at its measured width (fixed layout) rather
    // than leaving it on auto. An auto-layout table recomputes its own column
    // widths from whatever text is inside it, so a continuation page (which
    // holds different rows) would otherwise drift out of alignment with page 1
    // even though neither page was ever deliberately widened.
    head.style.width = colPx[0] + 'px';
    for (i = 1; i < heads.length; i++) heads[i].style.width = colPx[i] + 'px';
    if (autoLayout) { table.style.tableLayout = 'fixed'; table.style.width = tableW + 'px'; }
    return false;
  }

  function applyLevel(cells, base, level) {
    var py = (base.py * level.pad).toFixed(2) + 'px';
    var fs = (base.fs * level.font).toFixed(2) + 'px';
    for (var i = 0; i < cells.length; i++) {
      var s = cells[i].style;
      s.paddingTop = py;
      s.paddingBottom = py;
      s.fontSize = fs;
      s.lineHeight = String(level.line);
    }
  }

  /** A copy of the card that keeps only the subjects table (empty), for pages 2+. */
  function buildContinuation(card) {
    var clone = card.cloneNode(true);
    var table = clone.querySelector('table.rc2-subjects');
    // Walk from the table up to the card, deleting every sibling on the way.
    var keep = table;
    while (keep && keep !== clone) {
      var parent = keep.parentNode;
      var kids = Array.prototype.slice.call(parent.childNodes);
      for (var i = 0; i < kids.length; i++) if (kids[i] !== keep) parent.removeChild(kids[i]);
      keep = parent;
    }
    var tbody = table.tBodies[0];
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    clone.style.minHeight = '';
    clone.style.marginTop = '16px';   // visible gap between pages on screen only; not part of the PDF capture
    return { card: clone, tbody: tbody };
  }

  /**
   * Paginate whatever card is currently inside container.
   * Always starts from the untouched card (mount/refresh reset it first).
   */
  function paginate(container) {
    var card = container.querySelector('.rc-page');
    if (!card) return { pages: 1, reason: 'no-card' };

    var key = templateKeyOf(card);
    if (config.enabled.indexOf(key) < 0) return { pages: 1, reason: 'template-not-enabled' };

    var table = card.querySelector('table.rc2-subjects');
    var tbody = table && table.tBodies[0];
    if (!table || !tbody || !tbody.rows.length) return { pages: 1, reason: 'no-subjects-table' };

    // offsetWidth/offsetHeight ignore the on-screen shrink-to-fit transform,
    // so this measures the card at its true size.
    var pageH = card.offsetWidth * A4_RATIO;
    var limit = pageH - SAFETY_PX;

    // 0. Never more than maxRowsPage1 subjects on page 1; the rest go to page 2.
    var leftover = [];
    while (tbody.rows.length > config.maxRowsPage1) {
      leftover.unshift(tbody.rows[tbody.rows.length - 1]);
      tbody.removeChild(tbody.rows[tbody.rows.length - 1]);
    }

    // 1. Already fits? Leave it completely alone.
    if (card.offsetHeight <= limit && !leftover.length) return { pages: 1, changed: false };

    // 2. Tighten the subject rows, mildest first.
    var cells = tbody.querySelectorAll('td');
    var sample = cells[0];
    var cs = window.getComputedStyle(sample);
    var base = { py: pxNum(cs.paddingTop), fs: pxNum(cs.fontSize) };

    var spacing = collectSpacing(card, table);   // measured before anything is changed

    var chosen = -1;
    if (card.offsetHeight <= limit) chosen = -2;
    for (var li = 0; chosen === -1 && li < LEVELS.length; li++) {
      applyLevel(cells, base, LEVELS[li]);
      applySpacing(card, spacing, LEVELS[li]);
      fitNameColumn(card, table);
      if (card.offsetHeight <= limit) { chosen = li; break; }
    }
    if (chosen !== -1 && !leftover.length) return { pages: 1, changed: chosen >= 0, level: chosen + 1 };

    // 3. Still too tall at the tightest setting: move leftover subject rows onward.
    var level = chosen === -1 ? LEVELS.length : chosen + 1;
    while (card.offsetHeight > limit && tbody.rows.length > MIN_ROWS_PAGE1) {
      leftover.unshift(tbody.rows[tbody.rows.length - 1]);
      tbody.removeChild(tbody.rows[tbody.rows.length - 1]);
    }
    if (card.offsetHeight > limit) {
      // The fixed blocks alone (header, summary, remarks...) are taller than a page,
      // so moving subjects away cannot help. Put EVERY subject back, in order, so
      // nothing is ever lost from the report card, and let the caller carry on as
      // it always did (the card stays tightened, and simply runs longer than a page).
      for (var q = 0; q < leftover.length; q++) tbody.appendChild(leftover[q]);
      return { pages: 1, changed: true, level: level, reason: 'fixed-content-too-tall', overflowPx: card.offsetHeight - limit };
    }

    var pages = [card];
    var last = card;
    while (leftover.length && pages.length < MAX_PAGES) {
      var cont = buildContinuation(card);
      last.parentNode.insertBefore(cont.card, last.nextSibling);
      last = cont.card;
      pages.push(cont.card);

      while (leftover.length) {
        cont.tbody.appendChild(leftover[0]);
        if (cont.card.offsetHeight > limit && cont.tbody.rows.length > 1) {
          cont.tbody.removeChild(cont.tbody.lastChild);   // didn't fit: goes to the next page
          break;
        }
        leftover.shift();
      }
    }
    if (leftover.length) {
      // Out of pages (MAX_PAGES). Put the remainder on the last page rather than lose any subject.
      for (var r = 0; r < leftover.length; r++) last.querySelector('tbody').appendChild(leftover[r]);
    }

    for (var p = 0; p < pages.length; p++) stretchToSheet(pages[p], pageH);
    return { pages: pages.length, changed: true, level: level, rowsOnFirstPage: tbody.rows.length };
  }

  /** Draw html into container fresh and paginate it. */
  function draw(container, html) {
    container.innerHTML = html;
    var result;
    try {
      result = paginate(container);
    } catch (e) {
      // Pagination must never stop a report card from showing.
      container.innerHTML = html;
      result = { pages: 1, reason: 'error', error: String(e && e.message || e) };
    }
    return result;
  }

  /**
   * Replacement for container.innerHTML = html.
   * After web fonts finish loading (which can change text heights), the
   * card is drawn again from scratch; onRelayout is called only if that
   * changed the page count or how tightly the rows are drawn.
   */
  function mount(container, html, onRelayout) {
    container.__rcHtml = html;
    var result = draw(container, html);
    container.__rcResult = result;

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (container.__rcHtml !== html || !container.isConnected) return;
        var again = draw(container, html);
        var before = container.__rcResult || {};
        container.__rcResult = again;
        if (again.pages !== before.pages || again.level !== before.level || again.rowsOnFirstPage !== before.rowsOnFirstPage) {
          if (typeof onRelayout === 'function') onRelayout();
        }
      });
    }
    return result;
  }

  /** Redraw from the stored html (e.g. right before exporting) and wait for fonts first. */
  function settle(container) {
    var ready = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    return ready.then(function () {
      if (container.__rcHtml == null) return container.__rcResult || { pages: pagesOf(container.querySelector('.rc-page')).length };
      container.__rcResult = draw(container, container.__rcHtml);
      return container.__rcResult;
    });
  }

  /**
   * Multi-page PDF: each report card page becomes its own A4 page, so no row
   * or remark is ever cut in half. Used only when there is more than one
   * page; single-page cards keep going through each page's original code.
   * attempt is { scale, quality } (same knobs the pages already use).
   */
  async function renderPagesToPdf(pageEls, attempt) {
    var jsPDF = window.jspdf.jsPDF;
    var pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    var pw = pdf.internal.pageSize.getWidth();
    var ph = pdf.internal.pageSize.getHeight();

    for (var i = 0; i < pageEls.length; i++) {
      var el = pageEls[i];
      var bg = window.getComputedStyle(el).backgroundColor || '#ffffff';
      var canvas = await window.html2canvas(el, {
        scale: attempt.scale,
        useCORS: true,
        backgroundColor: bg === 'rgba(0, 0, 0, 0)' ? '#ffffff' : bg
      });
      var img = canvas.toDataURL('image/jpeg', attempt.quality);

      // Fill the sheet's width; if the page is (very slightly) taller than A4,
      // scale it down to fit rather than cut anything off.
      var w = pw;
      var h = (canvas.height * w) / canvas.width;
      if (h > ph) { h = ph; w = (canvas.width * h) / canvas.height; }
      var x = (pw - w) / 2;
      var y = 0;

      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', x, y, w, h);
    }
    return pdf;
  }

  window.ReportCardPagination = {
    config: config,
    mount: mount,
    settle: settle,
    pagesOf: pagesOf,
    renderPagesToPdf: renderPagesToPdf,
    // exposed for testing
    _paginate: paginate,
    _draw: draw,
    _levels: LEVELS,
    _fitNameColumn: fitNameColumn
  };
})();
`;

export const PAGE_DRIVER_JS = String.raw`
(function () {
  var MODE = window.__RC_MODE || 'print';
  var SHEET_W = 794;
  var SHEET_H = 1122;
  var RATIO = 297 / 210;
  var root = document.getElementById('rc-root');
  var original = root.innerHTML;

  function post(obj) {
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch (e) {}
  }

  function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }

  function stretch(el, h) {
    var cs = window.getComputedStyle(el);
    var vert = px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth);
    el.style.minHeight = Math.max(0, cs.boxSizing === 'border-box' ? h : h - vert) + 'px';
  }

  try { ReportCardPagination._draw(root, original); } catch (e) { root.innerHTML = original; }

  var first = root.querySelector('.rc-page');
  if (!first) { post({ type: 'pages', count: 1 }); return; }
  var pages = ReportCardPagination.pagesOf(first);
  var W = first.offsetWidth;
  var pageH = W * RATIO;
  var bg = window.getComputedStyle(first).backgroundColor;
  if (!bg || bg === 'rgba(0, 0, 0, 0)') bg = '#ffffff';

  var sheets = [];
  for (var i = 0; i < pages.length; i++) {
    var p = pages[i];
    p.style.marginTop = '0px';
    p.style.marginBottom = '0px';
    stretch(p, pageH);
    var ch = p.offsetHeight;
    var k = Math.min(SHEET_W / W, SHEET_H / Math.max(ch, 1));
    var sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.style.background = bg;
    p.parentNode.removeChild(p);
    p.style.zoom = String(k);
    sheet.appendChild(p);
    sheets.push(sheet);
  }

  root.innerHTML = '';
  root.style.width = 'auto';

  if (MODE === 'print') {
    for (var a = 0; a < sheets.length; a++) root.appendChild(sheets[a]);
    return;
  }

  var view = document.createElement('div');
  view.id = 'view';
  root.appendChild(view);
  for (var b = 0; b < sheets.length; b++) { sheets[b].style.display = 'none'; view.appendChild(sheets[b]); }

  var current = 0;
  var scale = 1;

  function layout() {
    scale = Math.min((window.innerWidth - 12) / SHEET_W, (window.innerHeight - 12) / SHEET_H);
    view.style.width = (SHEET_W * scale) + 'px';
    view.style.height = (SHEET_H * scale) + 'px';
    for (var c = 0; c < sheets.length; c++) sheets[c].style.transform = 'scale(' + scale + ')';
  }

  window.showPage = function (n) {
    if (n < 0) n = 0;
    if (n > sheets.length - 1) n = sheets.length - 1;
    current = n;
    for (var d = 0; d < sheets.length; d++) sheets[d].style.display = d === n ? 'block' : 'none';
    post({ type: 'page', index: n });
  };

  var sx = null;
  document.addEventListener('touchstart', function (e) {
    sx = e.touches.length === 1 ? e.touches[0].clientX : null;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (sx === null || !e.changedTouches.length) return;
    var zoomed = window.visualViewport && window.visualViewport.scale > 1.02;
    var dx = e.changedTouches[0].clientX - sx;
    sx = null;
    if (zoomed || Math.abs(dx) < 70) return;
    window.showPage(current + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('resize', layout);
  layout();
  window.showPage(0);
  post({ type: 'pages', count: sheets.length });
})();
`;

const BASE_CSS = '*{box-sizing:border-box;} html,body{margin:0;padding:0;} *{-webkit-print-color-adjust:exact;print-color-adjust:exact;} #rc-root{width:1000px;} .sheet{width:794px;height:1122px;overflow:hidden;position:relative;box-sizing:border-box;} tr{page-break-inside:avoid;}';

const PRINT_CSS = '@page{size:794px 1122px;margin:0;} html,body{background:#ffffff;} .sheet{page-break-after:always;break-after:page;} .sheet:last-child{page-break-after:auto;break-after:auto;}';

const PREVIEW_CSS = 'html,body{height:100%;overflow:hidden;background:#E5E7EB;} #rc-root{position:fixed;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;} #view{position:relative;overflow:hidden;background:#ffffff;box-shadow:0 2px 14px rgba(0,0,0,0.22);} .sheet{transform-origin:0 0;}';

export function buildPagedDocument(css: string, body: string, mode: 'preview' | 'print') {
  const viewport = mode === 'print' ? 'width=794' : 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=5, user-scalable=yes';
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="' + viewport + '">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700;800&family=Lora:wght@600;700;800&display=swap">' +
    '<style>' + BASE_CSS + ' ' + css + ' ' + (mode === 'print' ? PRINT_CSS : PREVIEW_CSS) + '</style></head><body>' +
    '<div id="rc-root">' + body + '</div>' +
    '<script>window.__RC_MODE=' + JSON.stringify(mode) + ';</script>' +
    '<script>' + PAGINATION_JS + '</script>' +
    '<script>' + PAGE_DRIVER_JS + '</script>' +
    '</body></html>'
  );
}
