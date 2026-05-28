/**
 * Annotation CSS injection (spec 006, R-5). Idempotent, guarded by
 * `data-gs-annotation-styles`. Mirrors the pattern in row-visibility-styles.ts.
 *
 * Ships the hover/focus pin affordance, the persistent corner-triangle marker
 * (a shape distinct in monochrome — FR-025), the pulse keyframe used by the
 * cross-document popup deep-link, the editor popover, and the cross-document
 * popup. The published IIFE does not ship src/style.css, so these rules must be
 * injected at runtime.
 */

// Minified at source: the IIFE keeps CSS as a string literal (terser does not
// minify CSS), so collapsing whitespace here is a direct bundle saving.
const ANNOTATION_CSS =
  '.gs-annotation-cell{position:relative}' +
  '.gs-annotation-pin{position:absolute;top:1px;right:1px;width:16px;height:16px;padding:0;margin:0;border:1px solid #c8d6ea;border-radius:50%;background:#eef3fb;color:#1a3760;font:11px/14px system-ui,sans-serif;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .1s;z-index:2}' +
  '.gs-annotation-pin::before{content:"\\270E"}' +
  '.gs-annotation-cell:hover .gs-annotation-pin,.gs-annotation-cell:focus-within .gs-annotation-pin,.gs-annotation-pin:focus{opacity:1;pointer-events:auto}' +
  // Persistent corner triangle: a SHAPE not just colour (FR-025); sized +
  // clip-path so it has a real, clickable hit area.
  '.gs-annotation-marker{position:absolute;top:0;right:0;width:12px;height:12px;padding:0;margin:0;border:0;background:#1976d2;clip-path:polygon(100% 0,0 0,100% 100%);cursor:pointer;z-index:1}' +
  '.gs-annotation-marker--pulse{animation:gs-annotation-pulse .6s ease-in-out 2}' +
  '@keyframes gs-annotation-pulse{0%{filter:none;transform:scale(1)}50%{filter:drop-shadow(0 0 3px #1976d2);transform:scale(1.6)}100%{filter:none;transform:scale(1)}}' +
  '.gs-annotation-aria{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}' +
  '.gs-annotation-popover,.gs-annotation-popup{position:absolute;z-index:10000;background:#fff;border:1px solid #c0c0c0;border-radius:4px;box-shadow:0 4px 12px rgb(0 0 0/15%);padding:8px;font:13px/1.4 system-ui,sans-serif;color:#222}' +
  '.gs-annotation-popover{min-width:220px}' +
  '.gs-annotation-popover textarea{display:block;width:100%;min-height:60px;box-sizing:border-box;font:inherit;resize:vertical}' +
  '.gs-annotation-popover__count{color:#888;font-size:11px;margin:2px 0}' +
  '.gs-annotation-popover__error{color:#b03030;font-size:12px;margin:2px 0}' +
  '.gs-annotation-popover__actions{display:flex;gap:6px;justify-content:flex-end;margin-top:4px}' +
  '.gs-annotation-popover__actions button{padding:2px 10px;font:inherit;background:#f5f5f5;border:1px solid #c0c0c0;border-radius:3px;cursor:pointer}' +
  '.gs-annotation-popover__actions button:disabled{opacity:.5;cursor:default}' +
  '.gs-annotation-popup{min-width:280px;max-width:420px;max-height:60vh;overflow:auto}' +
  '.gs-annotation-popup__group{margin-bottom:8px}' +
  '.gs-annotation-popup__group-label{font-weight:600;padding:2px 0}' +
  '.gs-annotation-popup__entry{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:3px;padding:4px 6px;cursor:pointer;font:inherit;color:inherit}' +
  '.gs-annotation-popup__entry:hover,.gs-annotation-popup__entry:focus{background:#eef3fb;outline:none}' +
  '.gs-annotation-popup__entry-text{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
  '.gs-annotation-popup__entry-meta{display:block;color:#888;font-size:11px}' +
  '.gs-annotation-popup__empty{color:#666;font-style:italic;padding:4px 6px}' +
  '.gs-annotations-menu-entry{position:fixed;bottom:12px;right:12px;z-index:9998;padding:6px 12px;background:#1976d2;color:#fff;border:0;border-radius:4px;font:13px/1.4 system-ui,sans-serif;cursor:pointer;box-shadow:0 2px 8px rgb(0 0 0/20%)}';

let injected = false;

export function ensureAnnotationStyles(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  if (document.head.querySelector('style[data-gs-annotation-styles]')) {
    injected = true;
    return;
  }
  const style = document.createElement('style');
  style.setAttribute('data-gs-annotation-styles', '');
  style.textContent = ANNOTATION_CSS;
  document.head.appendChild(style);
  injected = true;
}
