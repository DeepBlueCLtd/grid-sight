import type { Meta, StoryObj } from '@storybook/html';
import { expect, waitFor } from '@storybook/test';
import { injectToggle, activateToggle } from '../ui/toggle-injector';
import { setPageConfig, setVisitorOverride, resolveTableConfig } from '../core/enabled-set-state';

/**
 * Spec 015 — per-table options composition.
 *
 * Two tables on one page driven by `pageConfig.tables`: one offers only
 * sliders + statistics and starts active; the other offers only heatmap +
 * statistics and starts inactive. The story drives the same path init() uses
 * (injectToggle, then activateToggle when the resolved start-state is active)
 * so the rendered result mirrors the welcome page.
 */

const TABLE_MARKUP = `
  <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
  <tr><th>1000</th><td>4.8</td><td>6.2</td><td>7.2</td></tr>
  <tr><th>2000</th><td>4.4</td><td>5.7</td><td>6.7</td></tr>
  <tr><th>3000</th><td>4.1</td><td>5.4</td><td>6.4</td></tr>
`;

const meta: Meta = {
  title: 'Spec 015 / Per-table options',
  render: () => {
    setVisitorOverride(undefined);
    setPageConfig({
      enrichments: undefined,
      showToggleUi: false,
      tables: [
        { selector: '#story-sliders', enrichments: new Set(['sliders', 'statistics']), startActive: true },
        { selector: '#story-heatmap', enrichments: new Set(['heatmap', 'statistics']), startActive: false },
      ],
    });

    const container = document.createElement('div');
    container.style.cssText = 'display:flex; gap:32px; padding:20px; align-items:flex-start;';
    container.innerHTML = `
      <figure style="margin:0;">
        <figcaption style="font:600 13px system-ui; margin-bottom:8px;">#story-sliders — sliders + statistics, start active</figcaption>
        <table id="story-sliders" style="border-collapse:collapse;">${TABLE_MARKUP}</table>
      </figure>
      <figure style="margin:0;">
        <figcaption style="font:600 13px system-ui; margin-bottom:8px;">#story-heatmap — heatmap + statistics, start inactive</figcaption>
        <table id="story-heatmap" style="border-collapse:collapse;">${TABLE_MARKUP}</table>
      </figure>
    `;

    requestAnimationFrame(() => {
      for (const id of ['story-sliders', 'story-heatmap']) {
        const t = container.querySelector<HTMLTableElement>(`#${id}`);
        if (!t) continue;
        injectToggle(t);
        if (resolveTableConfig(t).startActive) activateToggle(t);
      }
    });

    return container;
  },
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj<typeof meta>;

function lozengeIds(scope: HTMLElement, tableId: string): Set<string> {
  const els = scope.querySelectorAll<HTMLElement>(`#${tableId} [data-gs-lozenge-id]`);
  return new Set(Array.from(els, (el) => el.getAttribute('data-gs-lozenge-id') as string));
}

export const DistinctSetsAndStartState: Story = {
  name: 'Two tables, distinct sets + start-active vs start-inactive',
  play: async ({ canvasElement }) => {
    // The start-active table shows its lozenges on load; the start-inactive one
    // shows none until its GS toggle is clicked.
    await waitFor(() => {
      const sliders = lozengeIds(canvasElement, 'story-sliders');
      expect(sliders.has('sliders')).toBe(true);
      expect(sliders.has('heatmap')).toBe(false);
    });

    const heatmapTable = lozengeIds(canvasElement, 'story-heatmap');
    expect(heatmapTable.size).toBe(0);

    // Reveal the start-inactive table in place — now its (different) set appears.
    const gs = canvasElement.querySelector<HTMLElement>('#story-heatmap .grid-sight-toggle');
    gs?.click();
    await waitFor(() => {
      const revealed = lozengeIds(canvasElement, 'story-heatmap');
      expect(revealed.has('heatmap')).toBe(true);
      expect(revealed.has('sliders')).toBe(false);
    });
  },
};
