import { describe, it, expect, beforeEach } from 'vitest';
import { applyAnnotations, saveAnnotation, __resetAnnotations } from '../annotations';
import { __resetIdentityWarnings, cellIdentity, identityKey } from '../annotation-identity';
import { writeDocumentAnnotations } from '../annotation-persistence';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)));

function makeTable(): HTMLTableElement {
  document.body.innerHTML = `
    <table data-gs-key="sales">
      <thead><tr><th>Region</th><th>Q3</th></tr></thead>
      <tbody>
        <tr data-gs-row-key="acme"><th scope="row">Acme</th><td>1200</td></tr>
        <tr data-gs-row-key="globex"><th scope="row">Globex</th><td>980</td></tr>
      </tbody>
    </table>`;
  return document.querySelector('table') as HTMLTableElement;
}

beforeEach(() => {
  localStorage.clear();
  __resetAnnotations();
  __resetIdentityWarnings();
  document.body.innerHTML = '';
});

describe('hydrate on load', () => {
  it('hydrates the store from localStorage and renders surviving markers', async () => {
    makeTable();
    writeDocumentAnnotations([
      { id: { tableKey: 'sales', rowKey: 'acme', columnKey: 'q3' }, text: 'restored', modifiedAt: 1 },
    ]);
    const table = document.querySelector('table') as HTMLTableElement;
    applyAnnotations(table);
    await nextFrame();
    const cell = table.querySelector('tbody td') as HTMLTableCellElement;
    expect(cell.querySelector('.gs-annotation-marker')).not.toBeNull();
    expect(cell.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('drops entries for missing rows/columns (FR-016)', async () => {
    makeTable();
    writeDocumentAnnotations([
      { id: { tableKey: 'sales', rowKey: 'nonexistent', columnKey: 'q3' }, text: 'orphan', modifiedAt: 1 },
    ]);
    const table = document.querySelector('table') as HTMLTableElement;
    applyAnnotations(table);
    await nextFrame();
    expect(table.querySelector('.gs-annotation-marker')).toBeNull();
  });

  it('drops entries for opted-out cells (FR-012)', async () => {
    document.body.innerHTML = `
      <table data-gs-key="sales">
        <thead><tr><th>Region</th><th>Q3</th></tr></thead>
        <tbody><tr data-gs-row-key="acme"><th scope="row">Acme</th><td data-gs-no-annotate>1200</td></tr></tbody>
      </table>`;
    writeDocumentAnnotations([
      { id: { tableKey: 'sales', rowKey: 'acme', columnKey: 'q3' }, text: 'x', modifiedAt: 1 },
    ]);
    const table = document.querySelector('table') as HTMLTableElement;
    applyAnnotations(table);
    await nextFrame();
    expect(table.querySelector('.gs-annotation-marker')).toBeNull();
  });
});

describe('identity stability across reorder (SC-004)', () => {
  it('keeps the same identity key when a cell row index changes', () => {
    const table = makeTable();
    const cell = table.querySelectorAll('tbody td')[0] as HTMLTableCellElement;
    const keyBefore = identityKey(cellIdentity(cell));
    const tbody = table.tBodies[0];
    tbody.insertBefore(tbody.rows[1], tbody.rows[0]);
    const keyAfter = identityKey(cellIdentity(cell));
    expect(keyAfter).toBe(keyBefore);
  });

  it('the marker stays a child of its source cell after a DOM reorder', () => {
    const table = makeTable();
    const cell = table.querySelectorAll('tbody td')[0] as HTMLTableCellElement;
    saveAnnotation(cell, 'glued');
    const marker = cell.querySelector('.gs-annotation-marker');
    const tbody = table.tBodies[0];
    tbody.insertBefore(tbody.rows[1], tbody.rows[0]);
    expect(cell.querySelector('.gs-annotation-marker')).toBe(marker);
  });
});
