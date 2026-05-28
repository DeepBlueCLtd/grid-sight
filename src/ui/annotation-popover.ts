/**
 * Annotation editor popover (spec 006, R-4). Builds a textarea + Save + Delete
 * + inline-error region and delegates focus-trap / Escape-to-close /
 * outside-click dismiss / positioning to the shared `installPopupChrome`
 * (the same helper the filter and statistics popups use).
 *
 * Keyboard contract (FR-005,6,7,8): focus lands in the textarea on open; Tab
 * cycles Save → Delete; Escape closes without saving; Delete is disabled when
 * no note exists; input and paste are clamped to 280 chars. On Save, a
 * `{ ok:false, reason:'quota' }` outcome keeps the popover open and shows the
 * inline refuse-and-warn error (FR-017).
 */

import { installPopupChrome, positionPopup } from './popup-chrome';
import {
  getAnnotation,
  saveAnnotation,
  deleteAnnotation,
} from '../enrichments/annotations';
import { ensureAnnotationStyles } from '../enrichments/annotation-styles';

const MAX_LEN = 280;
const QUOTA_MESSAGE = 'Storage is full — delete an existing note to add a new one';

let openDispose: (() => void) | null = null;

/** Open the editor popover anchored to `cell`, pre-filled with any existing
 *  note. */
export function openAnnotationPopover(cell: HTMLTableCellElement): void {
  if (typeof document === 'undefined') return;
  ensureAnnotationStyles();

  // Only one popover at a time.
  if (openDispose) {
    openDispose();
    openDispose = null;
  }

  const existing = getAnnotation(cell);

  const popup = document.createElement('div');
  popup.className = 'gs-annotation-popover';
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-label', 'Edit annotation');

  const textarea = document.createElement('textarea');
  textarea.maxLength = MAX_LEN;
  textarea.value = existing ?? '';
  textarea.setAttribute('aria-label', 'Annotation text');

  const count = document.createElement('div');
  count.className = 'gs-annotation-popover__count';
  const updateCount = () => {
    count.textContent = `${textarea.value.length}/${MAX_LEN}`;
  };

  const clamp = () => {
    if (textarea.value.length > MAX_LEN) {
      textarea.value = textarea.value.slice(0, MAX_LEN);
    }
    updateCount();
  };
  textarea.addEventListener('input', clamp);
  textarea.addEventListener('paste', () => {
    // Let the paste land, then clamp on the next tick.
    setTimeout(clamp, 0);
  });

  const error = document.createElement('div');
  error.className = 'gs-annotation-popover__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'gs-annotation-popover__actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = 'Save';

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.textContent = 'Delete';
  deleteBtn.disabled = !existing;

  actions.appendChild(saveBtn);
  actions.appendChild(deleteBtn);

  popup.appendChild(textarea);
  popup.appendChild(count);
  popup.appendChild(error);
  popup.appendChild(actions);
  document.body.appendChild(popup);

  positionPopup(popup, cell);
  updateCount();

  const dispose = installPopupChrome(popup, cell, [textarea, saveBtn, deleteBtn], () => {
    openDispose = null;
  });
  openDispose = dispose;

  saveBtn.addEventListener('click', () => {
    const result = saveAnnotation(cell, textarea.value);
    if (!result.ok) {
      error.textContent = QUOTA_MESSAGE;
      error.hidden = false;
      deleteBtn.disabled = !getAnnotation(cell);
      return;
    }
    dispose();
  });

  deleteBtn.addEventListener('click', () => {
    deleteAnnotation(cell);
    dispose();
  });

  // Focus lands in the textarea on open (FR-006).
  textarea.focus();
}
