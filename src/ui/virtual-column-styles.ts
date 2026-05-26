/**
 * Virtual-column CSS injection — extracted from `style.css` so the published
 * IIFE bundle ships these rules without depending on the dev-only `main.ts`
 * stylesheet entry. Idempotent: guarded by `data-gs-virtual-column-styles`.
 *
 * Mirrors `enrichments/slider-styles.ts` and `ui/row-visibility-styles.ts`.
 * Without this, virtual-column lozenges (Σ ⌇ Δ), the sparkline tooltip and
 * focus ring, the scale toggle, the source-column highlight, and the compare
 * picker's reversed-colour affordance all render unstyled on demo pages and in
 * any host that loads only the IIFE bundle.
 *
 * Keep this in sync with the "Virtual columns" block in `src/style.css`
 * (duplicated for the dev server / Storybook, same as the row-visibility CSS).
 */

const VIRTUAL_COLUMN_CSS = `
[data-gs-virtual-column] {
  background-color: rgb(0 0 0 / 2%);
}

th[data-gs-virtual-column] {
  font-weight: 600;
  white-space: nowrap;
}

td[data-gs-virtual-column="sparkline"] {
  padding: 2px 4px;
  vertical-align: middle;
}

td[data-gs-virtual-column="sparkline"]:focus {
  outline: 2px solid #4a90e2;
  outline-offset: -2px;
}

td[data-gs-virtual-column="compare"].gs-vc-up { color: #1a7f37; }
td[data-gs-virtual-column="compare"].gs-vc-down { color: #b35900; }
td[data-gs-virtual-column="compare"].gs-vc-eq { color: #57606a; }

.gs-vc-lozenge {
  display: inline-block;
  min-width: 1.2em;
  padding: 0 4px;
  margin-left: 4px;
  border: 1px solid currentcolor;
  border-radius: 3px;
  font-size: 0.85em;
  line-height: 1.2;
  cursor: pointer;
  user-select: none;
  background: transparent;
  color: inherit;
}

.gs-vc-lozenge:hover { background-color: rgb(0 0 0 / 5%); }

.gs-vc-lozenge:focus {
  outline: 2px solid #4a90e2;
  outline-offset: 1px;
}

.gs-vc-lozenge[aria-pressed="true"] {
  background-color: #4a90e2;
  color: #fff;
  border-color: #4a90e2;
}

th.gs-vc-source-highlight {
  background-color: rgb(74 144 226 / 15%);
}

.gs-vc-tooltip {
  position: absolute;
  background: #222;
  color: #fff;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 0.85em;
  pointer-events: none;
  z-index: 10000;
  white-space: nowrap;
}

.gs-vc-scale-toggle {
  margin-left: 6px;
  padding: 0 4px;
  border: 1px solid currentcolor;
  border-radius: 3px;
  background: transparent;
  color: inherit;
  font-size: 0.85em;
  line-height: 1.2;
  cursor: pointer;
}

.gs-vc-scale-toggle[aria-pressed="true"] {
  background: #4a90e2;
  color: #fff;
  border-color: #4a90e2;
}

/* Compare (Δ) picker affordance: reversed colours on the armed lozenge and
 * each picked column header; dashed outline on clickable candidate headers. */
.gs-vc-lozenge.gs-vc-pick-active {
  background: #4a90e2;
  color: #fff;
  border-color: #4a90e2;
}

th.gs-vc-pick-active {
  background-color: #4a90e2;
  color: #fff;
}

th.gs-vc-pick-target {
  cursor: pointer;
  outline: 2px dashed rgb(74 144 226 / 60%);
  outline-offset: -2px;
}
`;

const STYLE_MARKER = 'data-gs-virtual-column-styles';

/** Inject the virtual-column stylesheet once. No-op after the first call (and
 *  when another instance already injected it). Safe to call on every lozenge
 *  mount / directive activation. */
export function ensureVirtualColumnStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.head.querySelector(`style[${STYLE_MARKER}]`)) return;
  const style = document.createElement('style');
  style.setAttribute(STYLE_MARKER, '');
  style.textContent = VIRTUAL_COLUMN_CSS;
  document.head.appendChild(style);
}
