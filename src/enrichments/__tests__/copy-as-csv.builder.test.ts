import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildExportModel, serialiseModel } from '../copy-as-csv';
import { DEFAULT_COPY_OPTIONS, type CopyOptions } from '../../utils/copy-persistence';
import {
  registerVirtualColumnForCopy,
  unregisterVirtualColumnForCopy,
} from '../../utils/copy-as-csv-registry';

function makeTable(html: string): HTMLTableElement {
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  const table = wrap.querySelector('table') as HTMLTableElement;
  document.body.appendChild(table);
  return table;
}

const opts = (over: Partial<CopyOptions> = {}): CopyOptions => ({
  ...DEFAULT_COPY_OPTIONS,
  ...over,
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('buildExportModel — basic structure', () => {
  let table: HTMLTableElement;
  beforeEach(() => {
    table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><td>apple</td><td>3</td></tr>
          <tr><td>pear</td><td>5</td></tr>
        </tbody>
      </table>`);
  });

  it('captures all body rows with header text and a numeric → right align', () => {
    const m = buildExportModel(table, opts());
    expect(m.rowCount).toBe(2);
    expect(m.colCount).toBe(2);
    expect(m.columns.map((c) => c.headerText)).toEqual(['Name', 'Qty']);
    expect(m.columns[0].align).toBe('left');
    expect(m.columns[1].align).toBe('right');
    expect(m.matrix).toEqual([
      ['apple', '3'],
      ['pear', '5'],
    ]);
  });

  it('serialises to CSV with the header row first', () => {
    const m = buildExportModel(table, opts());
    expect(serialiseModel(m, opts())).toBe('Name,Qty\r\napple,3\r\npear,5');
  });

  it('omits the header row when headers is off', () => {
    const m = buildExportModel(table, opts({ headers: false }));
    expect(serialiseModel(m, opts({ headers: false }))).toBe('apple,3\r\npear,5');
  });
});

describe('buildExportModel — row headers', () => {
  let table: HTMLTableElement;
  beforeEach(() => {
    table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><th scope="row">apple</th><td>3</td></tr>
          <tr><th scope="row">pear</th><td>5</td></tr>
        </tbody>
      </table>`);
  });

  it('includes the leading th column when rowHeaders is on', () => {
    const m = buildExportModel(table, opts({ rowHeaders: true }));
    expect(m.columns[0].kind).toBe('row-header');
    expect(m.matrix).toEqual([
      ['apple', '3'],
      ['pear', '5'],
    ]);
  });

  it('drops the leading th column when rowHeaders is off', () => {
    const m = buildExportModel(table, opts({ rowHeaders: false }));
    expect(m.colCount).toBe(1);
    expect(m.columns[0].headerText).toBe('Qty');
    expect(m.matrix).toEqual([['3'], ['5']]);
  });
});

describe('buildExportModel — virtual columns', () => {
  let table: HTMLTableElement;
  beforeEach(() => {
    table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><td>apple</td><td>3</td></tr>
          <tr><td>pear</td><td>5</td></tr>
        </tbody>
      </table>`);
    let i = 0;
    registerVirtualColumnForCopy(table, 'vc1', {
      headerText: 'Σ Qty',
      getCellText: () => String((i += 3)),
    });
  });
  afterEach(() => unregisterVirtualColumnForCopy(table, 'vc1'));

  it('appends registered virtual columns when the option is on', () => {
    const m = buildExportModel(table, opts({ virtualCols: true }));
    expect(m.colCount).toBe(3);
    expect(m.columns[2].kind).toBe('virtual');
    expect(m.columns[2].headerText).toBe('Σ Qty');
    expect(m.matrix.map((r) => r[2])).toEqual(['3', '6']);
  });

  it('omits virtual columns when the option is off', () => {
    const m = buildExportModel(table, opts({ virtualCols: false }));
    expect(m.colCount).toBe(2);
    expect(m.columns.some((c) => c.kind === 'virtual')).toBe(false);
  });
});

describe('buildExportModel — exclusions and edges', () => {
  it('omits rows marked data-gs-no-export even when visible', () => {
    const table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><td>apple</td><td>3</td></tr>
          <tr data-gs-no-export><td>secret</td><td>9</td></tr>
          <tr><td>pear</td><td>5</td></tr>
        </tbody>
      </table>`);
    const m = buildExportModel(table, opts());
    expect(m.rowCount).toBe(2);
    expect(m.matrix).toEqual([
      ['apple', '3'],
      ['pear', '5'],
    ]);
  });

  it('keeps the header but emits zero rows for an empty visible view', () => {
    const table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody></tbody>
      </table>`);
    const m = buildExportModel(table, opts());
    expect(m.rowCount).toBe(0);
    expect(m.colCount).toBe(2);
    expect(serialiseModel(m, opts())).toBe('Name,Qty');
  });

  it('strips Grid-Sight-injected UI from cell values (cellValue)', () => {
    const table = makeTable(`
      <table>
        <thead><tr><th>Name</th><th>Qty</th></tr></thead>
        <tbody>
          <tr><td>apple<span class="gs-lozenge">H</span></td><td>3</td></tr>
        </tbody>
      </table>`);
    const m = buildExportModel(table, opts());
    expect(m.matrix[0][0]).toBe('apple');
  });
});

describe('buildExportModel — rowspan / colspan flatten', () => {
  it('places the value at its origin and leaves spanned cells blank', () => {
    const table = makeTable(`
      <table>
        <thead><tr><th>A</th><th>B</th><th>C</th></tr></thead>
        <tbody>
          <tr><td>a1</td><td rowspan="2">b</td><td>c1</td></tr>
          <tr><td>a2</td><td>c2</td></tr>
          <tr><td colspan="2">wide</td><td>c3</td></tr>
        </tbody>
      </table>`);
    const m = buildExportModel(table, opts());
    expect(m.colCount).toBe(3);
    expect(m.matrix).toEqual([
      ['a1', 'b', 'c1'],
      ['a2', '', 'c2'],
      ['wide', '', 'c3'],
    ]);
  });
});
