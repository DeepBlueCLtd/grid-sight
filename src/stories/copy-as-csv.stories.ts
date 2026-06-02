import type { Meta, StoryObj } from '@storybook/html';
import { within, expect, userEvent, waitFor } from '@storybook/test';
import { openCopyPopup } from '../ui/copy-csv-popup';
import { registerVirtualColumnForCopy } from '../utils/copy-as-csv-registry';

const SALES: Array<[string, string, number, number]> = [
  ['North', 'Q1', 120, 2400],
  ['North', 'Q2', 150, 3100],
  ['South', 'Q1', 90, 1800],
  ['East', 'Q1', 200, 4100],
];

function buildTable(): HTMLTableElement {
  const table = document.createElement('table');
  table.id = 'copy-story-table';
  table.style.borderCollapse = 'collapse';
  const body = SALES.map(
    ([region, q, u, r]) =>
      `<tr><td>${region}</td><td>${q}</td><td>${u}</td><td>${r}</td></tr>`,
  ).join('');
  table.innerHTML =
    `<thead><tr><th>Region</th><th>Quarter</th><th>Units</th><th>Revenue</th></tr></thead>` +
    `<tbody>${body}</tbody>`;
  table.querySelectorAll('th,td').forEach((c) => {
    const el = c as HTMLElement;
    el.style.border = '1px solid #ccc';
    el.style.padding = '4px 10px';
  });
  return table;
}

/** Mount a real copy lozenge wired to `openCopyPopup`, exactly as the descriptor
 *  does in the live library. */
function render(): HTMLElement {
  const wrap = document.createElement('div');
  const table = buildTable();

  // A registered virtual column proves the "Grid-Sight columns" option path.
  registerVirtualColumnForCopy(table, 'demo-vc', {
    headerText: 'Σ Revenue',
    getCellText: () => '—',
  });

  const loz = document.createElement('button');
  loz.type = 'button';
  loz.className = 'gs-lozenge';
  loz.textContent = '⎘';
  loz.setAttribute('aria-label', 'Copy table');
  loz.setAttribute('data-gs-lozenge-id', 'copy-as-csv');
  loz.style.marginBottom = '8px';
  loz.addEventListener('click', () => openCopyPopup({ table, anchor: loz }));

  wrap.append(loz, table);
  return wrap;
}

const meta: Meta = {
  title: 'Enrichments/Copy as CSV',
  render,
};
export default meta;

type Story = StoryObj;

/** Open the popup, assert the dialog controls, and exercise the textarea
 *  fallback (clipboard forced unavailable for a deterministic outcome). */
export const OpenCopyAndFallback: Story = {
  play: async ({ canvasElement }) => {
    // Force the clipboard fallback path so the assertion is deterministic.
    try {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        get() {
          return undefined;
        },
      });
    } catch {
      /* some engines disallow redefining; the fallback still triggers on reject */
    }

    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Copy table' }));

    const body = within(document.body);
    const popup = await waitFor(() => {
      const el = document.querySelector('.gs-copy-popup');
      if (!el) throw new Error('popup not open');
      return el as HTMLElement;
    });

    // Dialog structure: format radios + three option checkboxes + actions.
    expect(popup.getAttribute('role')).toBe('dialog');
    expect(popup.querySelectorAll('input[type="radio"]').length).toBe(3);
    expect(popup.querySelectorAll('input[type="checkbox"]').length).toBe(3);

    await userEvent.click(body.getByRole('button', { name: 'Copy' }));

    const ta = await waitFor(() => {
      const el = popup.querySelector('textarea');
      if (!el) throw new Error('fallback textarea not shown');
      return el as HTMLTextAreaElement;
    });
    expect(ta.value).toContain('Region,Quarter,Units,Revenue');
  },
};
