/**
 * Find-in-table search box (spec 014). A small popup — search input + match
 * counter + prev/next + close — wired to a `FindController` and built with
 * `installPopupChrome` for the focus-trap / Escape / focus-return contract.
 * Input is debounced (~120 ms). Also registers the table-level corner lozenge
 * (`headerType === 'table'`) that opens the box.
 */

import {
  createFindController,
  registerFindSession,
  clearFindSession,
} from '../enrichments/find-in-table';
import { installPopupChrome, positionPopup } from './popup-chrome';
import { registerEnrichment } from '../core/enrichment-registry';

const BOX_CLASS = 'gs-find-box';
const STYLE_ID = 'gs-find-styles';
const DEBOUNCE_MS = 120;

const FIND_CSS =
  '.gs-find-box{position:absolute;z-index:10000;display:flex;align-items:center;gap:4px;' +
  'padding:6px 8px;background:#fff;border:1px solid #cfd8e3;border-radius:6px;' +
  'box-shadow:0 4px 16px rgba(0,0,0,.15);font:13px/1.2 system-ui,sans-serif}' +
  '.gs-find-box input{font:13px/1.2 system-ui,sans-serif;padding:3px 6px;border:1px solid #c4d0de;border-radius:4px;width:150px}' +
  '.gs-find-box .gs-find-count{color:#567;min-width:64px;text-align:center;font-variant-numeric:tabular-nums}' +
  '.gs-find-box button{font:13px/1 system-ui,sans-serif;cursor:pointer;background:#eef2f7;border:1px solid #c4d0de;border-radius:4px;padding:3px 7px}' +
  '.gs-find-box button:hover{background:#dde6f0}' +
  '.gs-find-box button:focus-visible{outline:2px solid #1976d2;outline-offset:1px}' +
  '.gs-find-match{background:#fff3a0}' +
  '.gs-find-current{background:#ffd54a;outline:2px solid #d97706;outline-offset:-2px}';

function ensureFindStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = FIND_CSS;
  document.head.appendChild(style);
}

function button(label: string, ariaLabel: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.setAttribute('aria-label', ariaLabel);
  return b;
}

/** Build the search box wired to a FindController, anchored to `anchor`. */
export function openFindBox(table: HTMLTableElement, anchor: HTMLElement): void {
  ensureFindStyles();
  // Re-opening replaces any existing box for this table.
  removeOpenBox(table);

  const controller = createFindController(table);

  const box = document.createElement('div');
  box.className = BOX_CLASS;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-label', 'Find in table');

  const input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Find in table…';
  input.setAttribute('aria-label', 'Search term');

  const counter = document.createElement('span');
  counter.className = 'gs-find-count';

  const prevBtn = button('‹', 'Previous match');
  const nextBtn = button('›', 'Next match');
  const closeBtn = button('✕', 'Close find');

  box.append(input, counter, prevBtn, nextBtn, closeBtn);
  document.body.appendChild(box);
  positionPopup(box, anchor);

  const updateCounter = (): void => {
    counter.textContent =
      controller.matchCount() === 0
        ? '0 matches'
        : `${controller.currentOrdinal()} of ${controller.matchCount()}`;
  };
  updateCounter();

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      controller.search(input.value);
      updateCounter();
    }, DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      if (ev.shiftKey) controller.prev();
      else controller.next();
      updateCounter();
    }
  });
  prevBtn.addEventListener('click', () => {
    controller.prev();
    updateCounter();
  });
  nextBtn.addEventListener('click', () => {
    controller.next();
    updateCounter();
  });

  const dispose = installPopupChrome(box, anchor, [input, prevBtn, nextBtn, closeBtn], () => {
    if (timer !== undefined) clearTimeout(timer);
    controller.clear(); // remove highlights on close (byte-identical)
    clearFindSession(table);
  });
  closeBtn.addEventListener('click', () => dispose());

  registerFindSession(table, { controller, closeBox: dispose });
  input.focus();
}

function removeOpenBox(table: HTMLTableElement): void {
  // Closing via the registered session runs the popup-chrome onClose
  // (clears highlights + the session). If none, drop any stray box node.
  const existing = document.querySelectorAll<HTMLElement>('.' + BOX_CLASS);
  existing.forEach((el) => el.remove());
  clearFindSession(table);
}

/* ── Corner lozenge (table-level affordance) ────────────────────────── */

function buildFindLozenge(table: HTMLTableElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  // Reuse the shared lozenge class so it matches siblings and the existing
  // `removePlusIcons` teardown (which clears `.gs-lozenge` + empty clusters).
  btn.className = 'gs-lozenge';
  btn.textContent = '⌕';
  btn.title = 'Find in table';
  btn.setAttribute('aria-label', 'Find in table');
  btn.setAttribute('data-gs-lozenge-id', 'find-in-table');
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openFindBox(table, btn);
  });
  return btn;
}

registerEnrichment({
  id: 'find-in-table',
  appliesTo: (ctx) => ctx.headerType === 'table',
  mount: (ctx) => buildFindLozenge(ctx.table),
});
