import type { Meta, StoryObj } from '@storybook/html';
import { within, expect } from '@storybook/test';
import { createOutlierLozenge } from '../ui/outlier-lozenge';
import { openOutlierPopup } from '../ui/outlier-popup';
import {
  getOutlierThreshold,
  setOutlierThreshold,
  getOutlierMarks,
  tearDownOutliers,
  isColumnInert,
} from '../enrichments/outlier';

// One clear 2σ outlier (200), five at 1σ; mirrors the e2e demo fixture.
const LATENCY = [100, 100, 100, 100, 100, 100, 100, 100, 70, 130, 60, 140, 50, 150, 200, 30];

function buildTable(): HTMLTableElement {
  const table = document.createElement('table');
  table.id = 'outlier-story-table';
  table.style.borderCollapse = 'collapse';
  const body = LATENCY.map((v, i) => `<tr><td>S${i + 1}</td><td>${v}</td></tr>`).join('');
  table.innerHTML = `<thead><tr><th>Sample</th><th>Latency</th></tr></thead><tbody>${body}</tbody>`;
  table.querySelectorAll('th,td').forEach((c) => {
    const el = c as HTMLElement;
    el.style.border = '1px solid #ccc';
    el.style.padding = '4px 10px';
  });
  return table;
}

/** Mount a real outlier lozenge in the Latency header, wired to the orchestrator
 *  exactly as `header-utils` does. */
function mountLozenge(table: HTMLTableElement): void {
  const header = table.tHead!.rows[0].cells[1];
  let popupDispose: (() => void) | null = null;
  const loz = createOutlierLozenge({
    columnIndex: 1,
    columnKey: 'latency',
    inert: isColumnInert(table, 1),
    columnLabel: 'Latency',
    getCurrent: () => getOutlierThreshold(table, 1),
    onChange: (next) => setOutlierThreshold(table, 1, next),
    onShowList: () => {
      if (popupDispose) {
        popupDispose();
        return;
      }
      const threshold = getOutlierThreshold(table, 1);
      if (threshold === null) return;
      const anchor = loz.querySelector<HTMLElement>('[data-gs-lozenge-id="outlier"]')!;
      popupDispose = openOutlierPopup({
        table,
        columnIndex: 1,
        columnLabel: 'Latency',
        threshold,
        anchor,
        getMarks: () => getOutlierMarks(table, 1),
        onClose: () => {
          popupDispose = null;
        },
      });
    },
  });
  header.appendChild(loz);
}

const meta: Meta = {
  title: 'Features/Outlier Marker (spec 004)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The `!` lozenge flags cells beyond a click-cycled Nσ threshold ' +
          '(2σ → 1σ → 3σ → off) with a two-channel marker + tooltip, and opens a ' +
          'sorted outliers list. (spec 004-outlier)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.padding = '16px';
    container.style.maxWidth = '420px';
    const table = buildTable();
    container.appendChild(table);
    mountLozenge(table);
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const CycleThreshold: Story = {
  name: 'lozenge cycle: idle → 2σ → 1σ → 3σ → idle',
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('#outlier-story-table') as HTMLTableElement;
    tearDownOutliers(table); // clean slate on re-run
    const loz = canvasElement.querySelector('[data-gs-lozenge-id="outlier"]') as HTMLButtonElement;
    const marked = () => table.querySelectorAll('td.gs-outlier-cell').length;

    loz.click(); // → 2σ
    expect(loz.textContent).toBe('!2');
    expect(marked()).toBe(1);

    loz.click(); // → 1σ
    expect(loz.textContent).toBe('!1');
    expect(marked()).toBe(5);

    loz.click(); // → 3σ
    expect(loz.textContent).toBe('!3');
    expect(marked()).toBe(0);

    loz.click(); // → idle
    expect(loz.textContent).toBe('!');
    expect(loz.getAttribute('aria-pressed')).toBe('false');
  },
};

export const ListPopup: Story = {
  name: 'outliers list popup (sorted by descending |σ|)',
  play: async ({ canvasElement }) => {
    const table = canvasElement.querySelector('#outlier-story-table') as HTMLTableElement;
    tearDownOutliers(table);
    const loz = canvasElement.querySelector('[data-gs-lozenge-id="outlier"]') as HTMLButtonElement;
    loz.click(); // 2σ
    loz.click(); // 1σ → 5 outliers

    const listBtn = canvasElement.querySelector('[data-gs-outlier-list]') as HTMLButtonElement;
    listBtn.click();

    const root = within(document.body);
    const popup = await root.findByRole('dialog');
    expect(popup.getAttribute('aria-label')).toBe("Outliers in column 'Latency' at 1σ");
    const labels = Array.from(popup.querySelectorAll('.gs-outlier-popup__label')).map(
      (el) => (el.textContent ?? '').split(' — ')[0],
    );
    expect(labels).toEqual(['S15', 'S16', 'S13', 'S14', 'S11']);

    tearDownOutliers(table); // closes the popup + clears marks
  },
};
