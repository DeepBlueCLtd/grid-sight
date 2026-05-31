import { describe, it, expect } from 'vitest';
import { includeDemo } from '../../e2e/helpers/demo-discovery';

const GS_TABLE = `<script src="grid-sight.iife.js"></script><table id="t"><tr><td>1</td></tr></table>`;

describe('includeDemo (D13 inclusion filter)', () => {
  it('keeps a gridSight page that mounts on a real <table>', () => {
    expect(includeDemo('demo/annotations/single.html', GS_TABLE)).toBe(true);
  });

  it('excludes curated fixtures by path', () => {
    expect(includeDemo('demo/capability-filtering/fixture.html', GS_TABLE)).toBe(false);
    expect(includeDemo('demo/toggle/vc-panel-fixture.html', GS_TABLE)).toBe(false);
  });

  it('excludes perf / large pages by path', () => {
    expect(includeDemo('demo/row-visibility/perf-1000.html', GS_TABLE)).toBe(false);
  });

  it('excludes pages with no <table> (e.g. listing/index pages)', () => {
    const listing = `<script src="grid-sight.iife.js"></script><ul><li>a</li></ul>`;
    expect(includeDemo('demo/annotations/index.html', listing)).toBe(false);
  });

  it('excludes pages that never mount Grid-Sight', () => {
    const plain = `<table id="t"><tr><td>1</td></tr></table>`;
    expect(includeDemo('demo/misc/plain.html', plain)).toBe(false);
  });
});
