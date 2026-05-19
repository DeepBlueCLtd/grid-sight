/**
 * Shared chrome for the filter popups: focus trap (Tab cycling + Escape),
 * outside-click dismiss, and viewport positioning relative to a header
 * anchor. Used by both the numeric and categorical filter popups.
 */

function handleFocusTrap(
  ev: KeyboardEvent,
  focusables: readonly HTMLElement[]
): void {
  if (ev.key !== 'Tab' || focusables.length === 0) return;
  const idx = focusables.indexOf(document.activeElement as HTMLElement);
  if (ev.shiftKey && idx <= 0) {
    ev.preventDefault();
    focusables[focusables.length - 1].focus();
  } else if (!ev.shiftKey && idx === focusables.length - 1) {
    ev.preventDefault();
    focusables[0].focus();
  }
}

export function installPopupChrome(
  popup: HTMLElement,
  anchorEl: HTMLElement,
  focusables: readonly HTMLElement[],
  onClose: () => void
): () => void {
  let disposed = false;

  const trap = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      dispose();
      return;
    }
    handleFocusTrap(ev, focusables);
  };

  const outside = (ev: MouseEvent) => {
    if (!popup.contains(ev.target as Node) && ev.target !== anchorEl) {
      dispose();
    }
  };

  popup.addEventListener('keydown', trap);
  setTimeout(() => document.addEventListener('mousedown', outside), 0);

  function dispose() {
    if (disposed) return;
    disposed = true;
    popup.removeEventListener('keydown', trap);
    document.removeEventListener('mousedown', outside);
    if (popup.parentNode) popup.parentNode.removeChild(popup);
    try { anchorEl.focus(); } catch { /* ignore */ }
    onClose();
  }

  return dispose;
}

export function positionPopup(popup: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popup.style.position = 'absolute';
  popup.style.top = `${rect.bottom + window.scrollY + 2}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
}
