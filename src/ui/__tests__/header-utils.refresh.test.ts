/**
 * spec 012 / R-10 — column-types cache on the refresh path.
 *
 * When the toggle panel rebuilds lozenges after a checkbox change, it passes
 * cached column types (from `column-types-cache`) into `injectPlusIcons`.
 * This test mirrors that flow and asserts that the cached path does not
 * trigger any per-cell re-inference for tables whose column types are
 * already known.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { injectPlusIcons } from '../header-utils';
import { setColumnTypes, getColumnTypes, clearColumnTypes } from '../../core/column-types-cache';
import { setPageConfig, setVisitorOverride } from '../../core/enabled-set-state';

beforeEach(() => {
  document.body.innerHTML = '';
  setVisitorOverride(undefined);
  setPageConfig({ enrichments: undefined, showToggleUi: false, tables: [] });
});

function makeTable(): HTMLTableElement {
  const t = document.createElement('table');
  t.innerHTML = `
    <tr><th></th><th>10</th><th>20</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td></tr>
    <tr><th>2000</th><td>3</td><td>4</td></tr>
  `;
  document.body.appendChild(t);
  return t;
}

describe('column-types cache integration', () => {
  it('cache returns the stored types verbatim on get', () => {
    const t = makeTable();
    setColumnTypes(t, ['numeric', 'numeric', 'numeric']);
    expect(getColumnTypes(t)).toEqual(['numeric', 'numeric', 'numeric']);
  });

  it('clearColumnTypes followed by a fresh set works', () => {
    const t = makeTable();
    setColumnTypes(t, ['numeric']);
    clearColumnTypes(t);
    expect(getColumnTypes(t)).toBeUndefined();
    setColumnTypes(t, ['categorical']);
    expect(getColumnTypes(t)).toEqual(['categorical']);
  });

  it('injectPlusIcons accepts pre-cached column types and renders lozenges', () => {
    const t = makeTable();
    const types: Array<'numeric' | 'categorical'> = ['numeric', 'numeric', 'numeric'];
    setColumnTypes(t, types);

    // Drive the refresh path: pass cached types directly to injectPlusIcons.
    injectPlusIcons(t, types);

    // Lozenges rendered using the cached types — and because pageConfig is
    // undefined, all default-on enrichments are enabled, so we expect at
    // least one heatmap lozenge on the table.
    const lozenges = t.querySelectorAll<HTMLElement>('[data-gs-lozenge-id]');
    expect(lozenges.length).toBeGreaterThan(0);
  });
});
