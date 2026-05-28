/**
 * Per-cell outlier tooltip (spec 004-outlier, FR-007/FR-019).
 *
 * A marked cell exposes its `value / mean / σ` readout on BOTH mouse hover and
 * keyboard focus (FR-019 — not hover-only). The same text is wired to the cell
 * via `aria-describedby` so screen readers announce it on focus.
 *
 * The tooltip node lives in `document.body` (a GS-injected node), NOT inside
 * the cell — appending it into the cell would corrupt `cellValue` reads (and
 * therefore the stats it is describing). The cell keeps only attributes
 * (`tabindex`, `aria-describedby`) + the marker class/data, all removed on
 * detach so teardown is DOM byte-identical (SC-005).
 */

let tipCounter = 0;

/** Attach a hover/focus tooltip carrying `text` to `cell`. Returns a detacher
 *  that removes the tooltip node, its listeners, and the `aria-describedby`
 *  wiring (restoring any prior value). */
export function attachOutlierTooltip(cell: HTMLTableCellElement, text: string): () => void {
  const tip = document.createElement('div');
  tip.className = 'gs-outlier-tooltip';
  tip.id = `gs-outlier-tip-${++tipCounter}`;
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('data-gs-injected', '');
  tip.textContent = text;
  tip.style.display = 'none';
  document.body.appendChild(tip);

  const prevDescribedBy = cell.getAttribute('aria-describedby');
  cell.setAttribute(
    'aria-describedby',
    prevDescribedBy ? `${prevDescribedBy} ${tip.id}` : tip.id,
  );

  const show = (): void => {
    tip.style.display = 'block';
    positionTooltip(tip, cell);
  };
  const hide = (): void => {
    tip.style.display = 'none';
  };

  cell.addEventListener('mouseenter', show);
  cell.addEventListener('mouseleave', hide);
  cell.addEventListener('focus', show);
  cell.addEventListener('blur', hide);

  return () => {
    cell.removeEventListener('mouseenter', show);
    cell.removeEventListener('mouseleave', hide);
    cell.removeEventListener('focus', show);
    cell.removeEventListener('blur', hide);
    if (tip.parentNode) tip.parentNode.removeChild(tip);
    if (prevDescribedBy) cell.setAttribute('aria-describedby', prevDescribedBy);
    else cell.removeAttribute('aria-describedby');
  };
}

function positionTooltip(tip: HTMLElement, cell: HTMLElement): void {
  const rect = cell.getBoundingClientRect();
  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0;
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0;
  tip.style.position = 'absolute';
  tip.style.top = `${rect.bottom + scrollY + 2}px`;
  tip.style.left = `${rect.left + scrollX}px`;
}
