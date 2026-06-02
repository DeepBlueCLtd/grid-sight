/**
 * Copy-as-CSV popup (spec 009). A modal dialog with format radios, the three
 * option checkboxes, a Copy button, and a Close affordance — built with
 * `installPopupChrome` for the focus-trap / Escape / outside-click / focus-
 * return contract. On Copy it serialises the current visible view and writes it
 * to the clipboard, falling back to a pre-selected textarea when the async
 * clipboard interface is unavailable or denied.
 */

import { installPopupChrome, positionPopup } from './popup-chrome';
import {
  buildExportModel,
  serialiseModel,
  registerCopySession,
  clearCopySession,
} from '../enrichments/copy-as-csv';
import {
  resolveInitialCopyConfig,
  persistCopyConfig,
  type CopyFormat,
  type CopyOptions,
} from '../utils/copy-persistence';
import { showCopyToast } from './copy-toast';

const POPUP_CLASS = 'gs-copy-popup';
const STYLE_ID = 'gs-copy-popup-styles';

const FORMAT_LABEL: Record<CopyFormat, string> = {
  csv: 'CSV',
  tsv: 'TSV',
  md: 'Markdown',
};

const POPUP_CSS =
  `.${POPUP_CLASS}{position:absolute;z-index:10000;min-width:230px;max-width:320px;padding:12px 14px;` +
  'background:#fff;border:1px solid #cfd8e3;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,.18);' +
  'font:13px/1.4 system-ui,sans-serif;color:#222}' +
  `.${POPUP_CLASS} h2{font-size:13px;margin:0 0 8px;font-weight:600}` +
  `.${POPUP_CLASS} fieldset{border:0;margin:0 0 8px;padding:0}` +
  `.${POPUP_CLASS} legend{font-weight:600;margin:0 0 4px;padding:0}` +
  `.${POPUP_CLASS} label{display:flex;align-items:center;gap:6px;margin:2px 0;cursor:pointer}` +
  `.${POPUP_CLASS} .gs-copy-note{color:#567;font-size:12px;margin:0 0 10px}` +
  `.${POPUP_CLASS} .gs-copy-actions{display:flex;gap:8px;justify-content:flex-end}` +
  `.${POPUP_CLASS} button{font:13px/1 system-ui,sans-serif;cursor:pointer;background:#eef2f7;` +
  'border:1px solid #c4d0de;border-radius:4px;padding:5px 12px}' +
  `.${POPUP_CLASS} .gs-copy-primary{background:#1976d2;border-color:#1565c0;color:#fff}` +
  `.${POPUP_CLASS} textarea{width:100%;min-height:110px;box-sizing:border-box;border:1px solid #c4d0de;` +
  'border-radius:4px;padding:6px;font:12px/1.4 ui-monospace,monospace}';

const NOTE_TEXT =
  'Copies the current visible view (after sort and filter). Merged cells are ' +
  'flattened — the value stays in its origin cell, spanned cells are blank.';

function ensurePopupStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = POPUP_CSS;
  document.head.appendChild(style);
}

const openDisposers = new Set<() => void>();

export interface CopyPopupArgs {
  table: HTMLTableElement;
  anchor: HTMLElement;
  onClose?: () => void;
}

/** Open the copy dialog anchored to the lozenge. Returns a dispose() that closes
 *  it. Only one popup is open at a time. */
export function openCopyPopup(args: CopyPopupArgs): () => void {
  if (typeof document === 'undefined') return () => {};
  ensurePopupStyles();
  closeAllCopyPopups();

  const { table, anchor } = args;
  const config: CopyOptions = resolveInitialCopyConfig();

  const popup = document.createElement('div');
  popup.className = POPUP_CLASS;
  popup.setAttribute('role', 'dialog');
  popup.setAttribute('aria-modal', 'true');
  popup.setAttribute('aria-label', 'Copy table');
  popup.setAttribute('data-gs-injected', '');

  const title = document.createElement('h2');
  title.textContent = 'Copy table';
  popup.appendChild(title);

  // ── Format radios ──────────────────────────────────────────────────
  const formatSet = document.createElement('fieldset');
  const formatLegend = document.createElement('legend');
  formatLegend.textContent = 'Format';
  formatSet.appendChild(formatLegend);
  const radioName = `gs-copy-fmt-${Math.random().toString(36).slice(2, 8)}`;
  const radios: Record<CopyFormat, HTMLInputElement> = {} as Record<CopyFormat, HTMLInputElement>;
  (['csv', 'tsv', 'md'] as CopyFormat[]).forEach((fmt) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioName;
    radio.value = fmt;
    radio.checked = config.format === fmt;
    radio.addEventListener('change', () => {
      if (radio.checked) {
        config.format = fmt;
        persistCopyConfig(config);
      }
    });
    radios[fmt] = radio;
    label.append(radio, document.createTextNode(FORMAT_LABEL[fmt]));
    formatSet.appendChild(label);
  });
  popup.appendChild(formatSet);

  // ── Option checkboxes ──────────────────────────────────────────────
  const optionSet = document.createElement('fieldset');
  const optionLegend = document.createElement('legend');
  optionLegend.textContent = 'Include';
  optionSet.appendChild(optionLegend);
  const checkbox = (
    key: 'headers' | 'rowHeaders' | 'virtualCols',
    text: string,
  ): HTMLInputElement => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = config[key];
    cb.addEventListener('change', () => {
      config[key] = cb.checked;
      persistCopyConfig(config);
    });
    label.append(cb, document.createTextNode(text));
    optionSet.appendChild(label);
    return cb;
  };
  const headersCb = checkbox('headers', 'Headers');
  const rowHeadersCb = checkbox('rowHeaders', 'Row headers');
  const virtualColsCb = checkbox('virtualCols', 'Grid-Sight columns');
  popup.appendChild(optionSet);

  const note = document.createElement('p');
  note.className = 'gs-copy-note';
  note.textContent = NOTE_TEXT;
  popup.appendChild(note);

  // ── Actions ────────────────────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'gs-copy-actions';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'gs-copy-primary';
  copyBtn.textContent = 'Copy';
  actions.append(closeBtn, copyBtn);
  popup.appendChild(actions);

  document.body.appendChild(popup);
  positionPopup(popup, anchor);

  const focusables: HTMLElement[] = [
    radios.csv,
    radios.tsv,
    radios.md,
    headersCb,
    rowHeadersCb,
    virtualColsCb,
    closeBtn,
    copyBtn,
  ];

  const dispose = installPopupChrome(popup, anchor, focusables, () => {
    openDisposers.delete(dispose);
    clearCopySession(table);
    args.onClose?.();
  });
  openDisposers.add(dispose);
  registerCopySession(table, dispose);

  closeBtn.addEventListener('click', () => dispose());

  copyBtn.addEventListener('click', () => {
    void runCopy(table, config, popup, copyBtn, dispose);
  });

  try {
    radios[config.format].focus();
  } catch {
    /* ignore */
  }

  return dispose;
}

async function runCopy(
  table: HTMLTableElement,
  options: CopyOptions,
  popup: HTMLElement,
  copyBtn: HTMLButtonElement,
  dispose: () => void,
): Promise<void> {
  const model = buildExportModel(table, options);
  const text = serialiseModel(model, options);
  const label = FORMAT_LABEL[options.format];
  const count = `${model.rowCount} rows × ${model.colCount} columns`;

  let ok = false;
  try {
    const clip = navigator.clipboard;
    if (clip && typeof clip.writeText === 'function') {
      await clip.writeText(text);
      ok = true;
    }
  } catch {
    ok = false;
  }

  if (ok) {
    showCopyToast(`Copied ${count} as ${label}`);
    dispose();
    return;
  }

  // Fallback: swap the popup body for a pre-selected textarea (FR-014).
  showFallback(popup, copyBtn, text);
  showCopyToast(`Clipboard unavailable — copy ${count} manually from the box`);
}

function showFallback(popup: HTMLElement, copyBtn: HTMLButtonElement, text: string): void {
  // Remove the action buttons' Copy (no longer applicable) and inject a textarea.
  copyBtn.disabled = true;
  if (popup.querySelector('textarea')) return;
  const ta = document.createElement('textarea');
  ta.readOnly = true;
  ta.value = text;
  ta.setAttribute('aria-label', 'Serialised table — select and copy manually');
  popup.insertBefore(ta, popup.querySelector('.gs-copy-actions'));
  ta.focus();
  ta.select();
}

/** Close every open copy popup (used by removeCopyUi / teardown). */
export function closeAllCopyPopups(): void {
  for (const dispose of Array.from(openDisposers)) dispose();
  openDisposers.clear();
}
