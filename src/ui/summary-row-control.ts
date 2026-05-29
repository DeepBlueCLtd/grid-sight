/**
 * Per-cell aggregate chooser for the `summary-row` footer (spec 014).
 *
 * Numeric columns get a keyboard-operable <button> that cycles
 * sum → avg → min → max → count and reports the chosen aggregate via
 * `onChange`. Non-numeric columns only support `count`, so they render a static
 * label instead of a one-option control. The footer cell already holds the
 * computed value span; this only appends the control.
 */

import type { Aggregate } from '../enrichments/summary-row';

const CONTROL_CLASS = 'gs-summary-agg';
const KIND_CLASS = 'gs-summary-kind';
const STYLE_ID = 'gs-summary-row-styles';

/** Cycle order for numeric columns. */
const NUMERIC_CYCLE: readonly Aggregate[] = ['sum', 'avg', 'min', 'max', 'count'];

const LABELS: Record<Aggregate, string> = {
  sum: 'sum',
  avg: 'avg',
  min: 'min',
  max: 'max',
  count: 'count',
};

const SUMMARY_CSS =
  '.gs-summary-row td{border-top:2px solid #cfd8e3;background:var(--gs-summary-bg,#f7f9fc);' +
  'font-variant-numeric:tabular-nums;white-space:nowrap}' +
  '.gs-summary-value{font-weight:600;margin-right:6px}' +
  '.gs-summary-label{font-weight:600;color:#456}' +
  '.gs-summary-kind{color:#789;font-size:11px}' +
  '.gs-summary-agg{font:600 10px/1 system-ui,sans-serif;color:#456;background:#e7edf5;' +
  'border:1px solid #c4d0de;border-radius:8px;padding:1px 6px;cursor:pointer}' +
  '.gs-summary-agg:hover{background:#dae3ee}' +
  '.gs-summary-agg:focus-visible{outline:2px solid #1976d2;outline-offset:1px}';

/** Inject the summary-row stylesheet once (id `gs-summary-row-styles`). */
export function ensureSummaryStyles(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SUMMARY_CSS;
  document.head.appendChild(style);
}

/** Per-cell aggregate chooser; calls `onChange` with the next Aggregate. */
export function mountAggregateControl(
  cell: HTMLTableCellElement,
  current: Aggregate,
  numeric: boolean,
  onChange: (next: Aggregate) => void,
): void {
  if (!numeric) {
    // Only `count` is meaningful for a non-numeric column → static label.
    const label = document.createElement('span');
    label.className = KIND_CLASS;
    label.textContent = LABELS.count;
    cell.appendChild(label);
    return;
  }

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = CONTROL_CLASS;
  let kind: Aggregate = NUMERIC_CYCLE.includes(current) ? current : 'sum';

  const render = (): void => {
    btn.textContent = LABELS[kind];
    btn.title = `Aggregate: ${LABELS[kind]} (activate to cycle)`;
    btn.setAttribute('aria-label', `Aggregate: ${LABELS[kind]}. Activate to change.`);
  };
  render();

  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const idx = NUMERIC_CYCLE.indexOf(kind);
    kind = NUMERIC_CYCLE[(idx + 1) % NUMERIC_CYCLE.length];
    render();
    onChange(kind);
  });

  cell.appendChild(btn);
}
