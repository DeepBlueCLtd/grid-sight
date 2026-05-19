/**
 * Canonical registry of every enrichment Grid-Sight ships.
 *
 * Adding a new enrichment: append one entry below. The id MUST be lower-case
 * hyphen-separated and unique. `tearDown` is the runtime hook invoked when the
 * enrichment transitions from enabled → disabled while a live instance is on
 * a table; omit it for spec-only entries that have no live instance to clean
 * up yet.
 */

import { removeHeatmap } from '../enrichments/heatmap';
import { removeAllSliders, getSliders } from '../enrichments/slider';

export type EnrichmentId = string;

export interface EnrichmentRegistryEntry {
  readonly id: EnrichmentId;
  readonly label: string;
  readonly defaultOn: boolean;
  readonly tearDown?: (table: HTMLTableElement) => void;
}

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

function removeAllHeatmaps(table: HTMLTableElement): void {
  removeHeatmap(table);
}

function removeAllAxisSliders(table: HTMLTableElement): void {
  removeAllSliders(table);
}

function removeThresholdSliders(table: HTMLTableElement): void {
  for (const s of getSliders(table)) {
    if (s.kind === 'threshold') s.destroy();
  }
}

function dismissStatisticsPopup(_table: HTMLTableElement): void {
  const w = window as Window & { _gsStatisticsPopup?: { hide?: () => void } };
  w._gsStatisticsPopup?.hide?.();
}

function dismissFrequencyDialog(_table: HTMLTableElement): void {
  const w = window as Window & { _gsFrequencyDialog?: { hide?: () => void } };
  w._gsFrequencyDialog?.hide?.();
}

function dismissFrequencyChartDialog(_table: HTMLTableElement): void {
  const w = window as Window & { _gsFrequencyChartDialog?: { hide?: () => void } };
  w._gsFrequencyChartDialog?.hide?.();
}

const ENTRIES: EnrichmentRegistryEntry[] = [
  { id: 'heatmap',          label: 'Heatmap',           defaultOn: true, tearDown: removeAllHeatmaps },
  { id: 'sliders',          label: 'Sliders',           defaultOn: true, tearDown: removeAllAxisSliders },
  { id: 'slider-threshold', label: 'Threshold slider',  defaultOn: true, tearDown: removeThresholdSliders },
  { id: 'statistics',       label: 'Statistics popup',  defaultOn: true, tearDown: dismissStatisticsPopup },
  { id: 'frequency',        label: 'Frequency table',   defaultOn: true, tearDown: dismissFrequencyDialog },
  { id: 'frequency-chart',  label: 'Frequency chart',   defaultOn: true, tearDown: dismissFrequencyChartDialog },
  { id: 'annotations',      label: 'Cell annotations',  defaultOn: true },
  { id: 'copy-as-csv',      label: 'Copy as CSV',       defaultOn: true },
  { id: 'cumulative',       label: 'Cumulative col.',   defaultOn: true },
  { id: 'diff-compare',     label: 'Diff / compare',    defaultOn: true },
  { id: 'filter',           label: 'Column filter',     defaultOn: true },
  { id: 'outlier',          label: 'Outlier marker',    defaultOn: true },
  { id: 'sort',             label: 'Column sort',       defaultOn: true },
  { id: 'sparkline',        label: 'Row sparkline',     defaultOn: true },
  { id: 'units-toggle',     label: 'Units toggle',      defaultOn: true },
];

// Boot-time validation.
{
  const seen = new Set<string>();
  for (const e of ENTRIES) {
    if (!ID_PATTERN.test(e.id)) {
      throw new Error(`[gridsight] enrichment-registry: invalid id "${e.id}" (must match ${ID_PATTERN})`);
    }
    if (seen.has(e.id)) {
      throw new Error(`[gridsight] enrichment-registry: duplicate id "${e.id}"`);
    }
    if (!e.label || typeof e.label !== 'string') {
      throw new Error(`[gridsight] enrichment-registry: id "${e.id}" has empty label`);
    }
    seen.add(e.id);
  }
}

export const ENRICHMENT_REGISTRY: readonly EnrichmentRegistryEntry[] = Object.freeze(
  ENTRIES.map(e => Object.freeze({ ...e })) as EnrichmentRegistryEntry[]
);

export const ENRICHMENT_IDS: readonly EnrichmentId[] = Object.freeze(
  ENRICHMENT_REGISTRY.map(e => e.id)
);
