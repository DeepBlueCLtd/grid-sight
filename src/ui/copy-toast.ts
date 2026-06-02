/**
 * Transient copy confirmation toast (spec 009, FR-015/FR-016/FR-022).
 * A singleton `role="status"` `aria-live="polite"` region appended to the body.
 * It never receives focus and auto-dismisses after at most 5 seconds.
 */

import { registerToastHide } from '../enrichments/copy-as-csv';

const TOAST_ID = 'gs-copy-toast';
const STYLE_ID = 'gs-copy-toast-styles';
const DISMISS_MS = 5000;

const TOAST_CSS =
  `#${TOAST_ID}{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:10001;` +
  'max-width:80vw;padding:8px 14px;background:#1f2937;color:#fff;border-radius:6px;' +
  'box-shadow:0 4px 16px rgba(0,0,0,.25);font:13px/1.3 system-ui,sans-serif;opacity:0;' +
  'transition:opacity .12s ease}' +
  `#${TOAST_ID}.gs-copy-toast--visible{opacity:1}`;

let timer: ReturnType<typeof setTimeout> | undefined;

function ensureToastStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = TOAST_CSS;
  document.head.appendChild(style);
}

function getToast(): HTMLElement {
  let el = document.getElementById(TOAST_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = TOAST_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('data-gs-injected', '');
    document.body.appendChild(el);
  }
  return el;
}

/** Announce a transient message. Replaces any current message; auto-dismisses. */
export function showCopyToast(message: string): void {
  if (typeof document === 'undefined') return;
  ensureToastStyles();
  const el = getToast();
  el.textContent = message;
  // Force a reflow so re-shows re-trigger the fade when text is unchanged.
  void el.offsetWidth;
  el.classList.add('gs-copy-toast--visible');
  if (timer !== undefined) clearTimeout(timer);
  timer = setTimeout(hideCopyToast, DISMISS_MS);
}

/** Hide and remove the toast immediately (teardown). */
export function hideCopyToast(): void {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  const el = typeof document !== 'undefined' ? document.getElementById(TOAST_ID) : null;
  if (el) {
    el.classList.remove('gs-copy-toast--visible');
    el.textContent = '';
  }
}

// Let the orchestrator's teardown clear the toast without an enrichments → ui
// import cycle.
registerToastHide(hideCopyToast);
