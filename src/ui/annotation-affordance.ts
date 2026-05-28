/**
 * Annotation affordance + persistent marker (spec 006, R-5).
 *
 * `mountAffordance` adds a hover/focus pin button to a body cell and shims the
 * cell to `position: relative` (via a class). `renderMarker` paints the
 * persistent corner-triangle marker, wires an accessible name, and points the
 * cell's `aria-describedby` at a visually-hidden node holding the note text
 * (FR-004, FR-023). All injected DOM carries `data-gs-injected` so teardown can
 * restore byte-identical cells.
 */

import { ensureAnnotationStyles } from '../enrichments/annotation-styles';

const CELL_CLASS = 'gs-annotation-cell';
const PIN_CLASS = 'gs-annotation-pin';
const MARKER_CLASS = 'gs-annotation-marker';
const ARIA_CLASS = 'gs-annotation-aria';
const PULSE_CLASS = 'gs-annotation-marker--pulse';

type Activator = (cell: HTMLTableCellElement) => void;

const activators = new WeakMap<HTMLTableCellElement, Activator>();
let ariaSeq = 0;

/** Mount the hover/focus pin affordance on a body cell. Idempotent. */
export function mountAffordance(cell: HTMLTableCellElement, onActivate: Activator): void {
  ensureAnnotationStyles();
  cell.classList.add(CELL_CLASS);
  activators.set(cell, onActivate);

  if (cell.querySelector(`:scope > .${PIN_CLASS}`)) return;
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = PIN_CLASS;
  pin.setAttribute('data-gs-injected', '');
  pin.setAttribute('aria-label', 'Add or edit annotation');
  // The ✎ glyph is drawn via CSS ::before so the button contributes NO text to
  // the cell's textContent — keeping annotated cells readable by value-reading
  // code (sort/filter, tests) byte-for-byte.
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    onActivate(cell);
  });
  cell.appendChild(pin);
}

/** Show/refresh the persistent corner marker for a cell that has a note. */
export function renderMarker(cell: HTMLTableCellElement, text: string): void {
  ensureAnnotationStyles();
  cell.classList.add(CELL_CLASS);

  let marker = cell.querySelector<HTMLButtonElement>(`:scope > .${MARKER_CLASS}`);
  if (!marker) {
    marker = document.createElement('button');
    marker.type = 'button';
    marker.className = MARKER_CLASS;
    marker.setAttribute('data-gs-injected', '');
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      activators.get(cell)?.(cell);
    });
    cell.appendChild(marker);
  }
  marker.setAttribute('aria-label', `Annotated cell — click to view note: ${text}`);
  marker.title = text;

  let aria = cell.querySelector<HTMLSpanElement>(`:scope > .${ARIA_CLASS}`);
  if (!aria) {
    aria = document.createElement('span');
    aria.className = ARIA_CLASS;
    aria.setAttribute('data-gs-injected', '');
    aria.id = `gs-annot-desc-${++ariaSeq}`;
    cell.appendChild(aria);
  }
  aria.textContent = text;
  cell.setAttribute('aria-describedby', aria.id);
}

/** Remove the marker + aria-describedby node from a cell. */
export function clearMarker(cell: HTMLTableCellElement): void {
  cell.querySelector(`:scope > .${MARKER_CLASS}`)?.remove();
  const aria = cell.querySelector(`:scope > .${ARIA_CLASS}`);
  if (aria) {
    if (cell.getAttribute('aria-describedby') === aria.id) {
      cell.removeAttribute('aria-describedby');
    }
    aria.remove();
  }
}

/** Briefly pulse a cell's marker (popup scroll-target highlight, FR-021). */
export function pulseMarker(cell: HTMLTableCellElement): void {
  const marker = cell.querySelector<HTMLElement>(`:scope > .${MARKER_CLASS}`);
  if (!marker) return;
  marker.classList.remove(PULSE_CLASS);
  // Force reflow so re-adding the class restarts the animation.
  void marker.offsetWidth;
  marker.classList.add(PULSE_CLASS);
}

/** Remove all injected annotation DOM from a cell and restore it byte-identical
 *  (pin, marker, aria node, the relative-positioning class, aria-describedby). */
export function removeAffordance(cell: HTMLTableCellElement): void {
  cell.querySelector(`:scope > .${PIN_CLASS}`)?.remove();
  clearMarker(cell);
  cell.classList.remove(CELL_CLASS);
  if (cell.getAttribute('class') === '') cell.removeAttribute('class');
  activators.delete(cell);
}
