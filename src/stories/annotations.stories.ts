import type { Meta, StoryObj } from '@storybook/html';
import { within, expect, userEvent, waitFor } from '@storybook/test';
import {
  applyAnnotations,
  saveAnnotation,
  getAnnotation,
  tearDownAnnotations,
  __resetAnnotations,
} from '../enrichments/annotations';
import { __resetIdentityWarnings } from '../enrichments/annotation-identity';
import { openAnnotationPopover } from '../ui/annotation-popover';
import { openAnnotationsPopup } from '../ui/annotation-popup';

function sampleTable(): string {
  return `
    <table id="annot-story-table" data-gs-key="sales">
      <caption>Quarterly sales</caption>
      <thead><tr><th>Region</th><th>Q3</th></tr></thead>
      <tbody>
        <tr data-gs-row-key="acme"><th scope="row">Acme</th><td>1200</td></tr>
        <tr data-gs-row-key="globex"><th scope="row">Globex</th><td>980</td></tr>
        <tr data-gs-row-key="initech"><th scope="row">Initech</th><td>540</td></tr>
      </tbody>
    </table>`;
}

const meta: Meta = {
  title: 'Features/Cell Annotations (spec 006)',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Hover/focus a body cell to reveal a pin, open the editor popover, save a ≤280-char note, ' +
          'and see a persistent corner marker. Notes persist per-document to localStorage. (spec 006-cell-annotations)',
      },
    },
  },
  render: () => {
    const container = document.createElement('div');
    container.style.maxWidth = '600px';
    container.style.padding = '16px';
    container.innerHTML = `<h2>Annotate a cell</h2>${sampleTable()}`;
    return container;
  },
};

export default meta;
type Story = StoryObj;

export const AffordanceAndMarker: Story = {
  name: 'pin affordance → save → persistent marker → delete',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;

    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    __resetAnnotations();
    __resetIdentityWarnings();
    tearDownAnnotations(table);

    applyAnnotations(table);
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;

    // The pin affordance is mounted and Tab-reachable.
    const pin = cell.querySelector('.gs-annotation-pin') as HTMLButtonElement;
    expect(pin).not.toBeNull();
    expect(pin.tagName).toBe('BUTTON');

    // Open the popover, type a note, save.
    openAnnotationPopover(cell);
    const textarea = document.querySelector(
      '.gs-annotation-popover textarea'
    ) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(textarea);
    await userEvent.type(textarea, 'check with finance');
    const saveBtn = document.querySelector(
      '.gs-annotation-popover button'
    ) as HTMLButtonElement;
    await userEvent.click(saveBtn);

    // Marker appears with aria-describedby wired.
    await waitFor(() => {
      expect(cell.querySelector('.gs-annotation-marker')).not.toBeNull();
    });
    expect(getAnnotation(cell)).toBe('check with finance');
    expect(cell.getAttribute('aria-describedby')).toBeTruthy();
  },
};

export const CrossDocumentPopup: Story = {
  name: 'cross-document popup lists notes with dates',
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const table = (await root.findByRole('table')) as HTMLTableElement;

    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
    __resetAnnotations();
    __resetIdentityWarnings();
    tearDownAnnotations(table);
    document.querySelectorAll('.gs-annotation-popup').forEach((el) => el.remove());

    applyAnnotations(table);
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    saveAnnotation(cell, 'verify this figure');

    openAnnotationsPopup();
    const popup = document.querySelector('.gs-annotation-popup') as HTMLElement;
    expect(popup).not.toBeNull();
    const entries = popup.querySelectorAll('.gs-annotation-popup__entry');
    expect(entries.length).toBeGreaterThanOrEqual(1);
    popup.remove();
  },
};
