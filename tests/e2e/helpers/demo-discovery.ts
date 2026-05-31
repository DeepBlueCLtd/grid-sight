import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Page } from '@playwright/test';
import type { EnrichmentId, GridSightWindow } from './gridsight-window';

/** Repo-root-relative root the demos are globbed from and served under. */
const DEMO_ROOT = join(process.cwd(), 'public');
const DEMO_DIR = join(DEMO_ROOT, 'demo');

export interface DemoPage {
  /** Path relative to `public/`, e.g. `demo/annotations/single.html`. */
  relPath: string;
  /** Absolute URL under the shared server's `baseURL`. */
  url(baseUrl: string): string;
}

/**
 * Pure inclusion filter (unit-tested, D9). A demo is part of the matrix when it
 * actually mounts Grid-Sight on a real `<table>` — and is NOT a curated fixture
 * or a perf/large page (D13: those carry authored oracles / heavy data and are
 * exercised by dedicated specs, not the breadth matrix).
 */
export function includeDemo(relPath: string, contents: string): boolean {
  const normalized = relPath.split(sep).join('/');
  if (/fixture/i.test(normalized)) return false;
  if (/perf|large|\b\d{3,}\b/i.test(normalized)) return false;
  const mountsGridSight = /grid-?sight/i.test(contents);
  const hasTable = /<table[\s>]/i.test(contents);
  return mountsGridSight && hasTable;
}

/** Recursively list every `.html` under `public/demo`. */
function walkHtml(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...walkHtml(full));
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Sync, Node-side glob of the demo pages the breadth matrix should cover.
 * Runs at collection time (outside the browser), so it uses `fs` directly.
 */
export function discoverDemoPages(): DemoPage[] {
  return walkHtml(DEMO_DIR)
    .map((abs) => relative(DEMO_ROOT, abs).split(sep).join('/'))
    .filter((rel) => includeDemo(rel, readFileSync(join(DEMO_ROOT, rel), 'utf8')))
    .sort()
    .map((relPath) => ({
      relPath,
      url: (baseUrl: string) => `${baseUrl.replace(/\/$/, '')}/${relPath}`,
    }));
}

/**
 * Read the live page's enrichment profile. The offered set is the page's
 * explicit allow-list when present, otherwise the full shipped set.
 */
export async function readPageProfile(page: Page): Promise<{
  offered: EnrichmentId[];
  tableIds: string[];
  hasToggleUi: boolean;
}> {
  return page.evaluate(() => {
    const gs = (window as unknown as GridSightWindow).gridSight;
    // An explicit non-empty allow-list wins; an empty (or absent) list means
    // "offer the full shipped registry set" (matrix-fixture contract).
    const allow = gs.pageConfig?.enrichments;
    const offered = allow && allow.length > 0 ? allow : [...gs.enrichmentIds];
    const tableIds = Array.from(document.querySelectorAll('table'))
      .map((t) => t.id)
      .filter((id) => id.length > 0);
    const hasToggleUi = !!document.querySelector('[data-gs-toggle-panel-root]');
    return { offered: [...offered], tableIds, hasToggleUi };
  });
}
