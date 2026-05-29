/**
 * Sticky-pane stylesheet for the `freeze-panes` enrichment (spec 014).
 *
 * Injected once into <head>. Scoped entirely under the `.gs-freeze` class that
 * `applyFreezePanes` puts on the <table>, so removing that class (+ the two
 * cell classes) is enough to restore a byte-identical, un-frozen table — the
 * <style> node may stay resident in <head> with no visible effect.
 *
 * CSS is authored pre-minified: terser does not minify string literals, so a
 * hand-minified string keeps the bundle cost at the §R-9 sub-budget (≤ 0.6 KB).
 * Opaque backgrounds (overridable via `--gs-freeze-bg`) stop scrolling content
 * showing through the pinned header/key cells; no inline styles are written to
 * any cell, which keeps teardown trivially exact.
 */

const STYLE_ID = 'gs-freeze-styles';

// Pre-minified. Header sticks to the top, key column to the left; the corner
// (a cell carrying both classes) sits above both. z-index order: corner(3) >
// header(2) > key(1) so the header band always wins over the key column.
const FREEZE_CSS =
  '.gs-freeze .gs-freeze-header{position:sticky;top:0;z-index:2;background:var(--gs-freeze-bg,#fff)}' +
  '.gs-freeze .gs-freeze-col{position:sticky;left:0;z-index:1;background:var(--gs-freeze-bg,#fff)}' +
  '.gs-freeze .gs-freeze-header.gs-freeze-col{z-index:3}';

let injected = false;

/** Inject the minified sticky stylesheet once (id `gs-freeze-styles`). */
export function ensureFreezeStyles(): void {
  if (typeof document === 'undefined') return;
  if (injected) return;
  if (document.getElementById(STYLE_ID)) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FREEZE_CSS;
  document.head.appendChild(style);
  injected = true;
}
