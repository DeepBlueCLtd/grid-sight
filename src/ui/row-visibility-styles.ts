/**
 * Row-visibility CSS injection — extracted from `style.css` so the published
 * IIFE bundle ships these rules without depending on the dev-only `main.ts`
 * stylesheet entry. Idempotent: guarded by `data-gs-row-visibility-styles`.
 *
 * Mirrors the pattern in `enrichments/slider-styles.ts`. Without this, the
 * filter popup renders with a transparent background and dimmed rows look
 * identical to visible rows because the `.gs-row--dimmed` opacity rule
 * never reaches the page.
 */

const ROW_VISIBILITY_CSS = `
.gs-lozenge--sort::before { content: '\\2195'; }
.gs-lozenge--filter::before { content: '\\25BD'; }

.gs-row--dimmed,
tr[data-gs-dimmed="true"] {
  opacity: 0.35;
}

.gs-filter-chip-container {
  margin-top: 0.5em;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  font: 12px/1.4 system-ui, sans-serif;
}

.gs-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  background: #eef3fb;
  border: 1px solid #c8d6ea;
  border-radius: 12px;
  color: #1a3760;
}

.gs-filter-chip__remove {
  background: transparent;
  border: 0;
  padding: 0 2px;
  cursor: pointer;
  color: inherit;
  font: inherit;
}

.gs-filter-chip__clear-all {
  background: transparent;
  border: 1px solid #c8d6ea;
  border-radius: 12px;
  padding: 2px 8px;
  cursor: pointer;
  font: inherit;
  color: #1a3760;
}

.gs-filter-empty-state {
  color: #b03030;
  font-style: italic;
  margin-left: 6px;
}

.gs-filter-popup {
  position: absolute;
  z-index: 9999;
  background: #fff;
  border: 1px solid #c0c0c0;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgb(0 0 0 / 15%);
  padding: 8px;
  font: 13px/1.4 system-ui, sans-serif;
  color: #222;
  min-width: 220px;
}

.gs-filter-popup__row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  align-items: center;
}

.gs-filter-popup__row label { white-space: nowrap; }

.gs-filter-popup__row input[type="number"],
.gs-filter-popup__row input[type="text"],
.gs-filter-popup__search {
  padding: 2px 4px;
  font: inherit;
}

.gs-filter-popup__list {
  max-height: 200px;
  overflow: auto;
  border: 1px solid #e0e0e0;
  padding: 4px;
  margin: 4px 0;
}

.gs-filter-popup__list label { display: block; cursor: pointer; }

.gs-filter-popup__actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
}

.gs-filter-popup__actions button {
  padding: 2px 8px;
  font: inherit;
  background: #f5f5f5;
  border: 1px solid #c0c0c0;
  border-radius: 3px;
  cursor: pointer;
}
`;

let injected = false;

export function ensureRowVisibilityStyles(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('style[data-gs-row-visibility-styles]')) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-gs-row-visibility-styles', '');
  style.textContent = ROW_VISIBILITY_CSS;
  document.head.appendChild(style);
  injected = true;
}
