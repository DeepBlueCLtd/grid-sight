import { describe, it, expect, beforeEach } from 'vitest';
import { detectTwin, isTwinTable } from '../twin-grid';

beforeEach(() => {
  document.body.innerHTML = '';
});

function twinTable(): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.innerHTML = `
    <thead>
      <tr><th>Season</th><th>Speed</th><th>000°</th><th>045°</th><th>090°</th><th>135°</th><th>180°</th></tr>
    </thead>
    <tbody>
      <tr><th rowspan="6">Summer</th><th>30</th><td>18.2</td><td>17.4</td><td>15.9</td><td>14.1</td><td>13.0</td></tr>
      <tr><th>40</th><td>16.8</td><td>16.0</td><td>14.6</td><td>12.9</td><td>11.8</td></tr>
      <tr><th>50</th><td>15.1</td><td>14.4</td><td>13.1</td><td>11.5</td><td>10.5</td></tr>
      <tr><th>60</th><td>13.3</td><td>12.7</td><td>11.5</td><td>10.0</td><td>9.1</td></tr>
      <tr><th>70</th><td>11.4</td><td>10.9</td><td>9.8</td><td>8.5</td><td>7.7</td></tr>
      <tr><th>80</th><td>9.6</td><td>9.1</td><td>8.2</td><td>7.0</td><td>6.3</td></tr>
      <tr><th rowspan="4">Winter</th><th>20</th><td>15.0</td><td>14.3</td><td>13.0</td><td>11.4</td><td>10.4</td></tr>
      <tr><th>30</th><td>13.6</td><td>12.9</td><td>11.7</td><td>10.2</td><td>9.2</td></tr>
      <tr><th>40</th><td>12.0</td><td>11.4</td><td>10.3</td><td>8.9</td><td>8.0</td></tr>
      <tr><th>60</th><td>8.7</td><td>8.2</td><td>7.3</td><td>6.2</td><td>5.5</td></tr>
    </tbody>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('detectTwin', () => {
  it('models a twin table as two independent sub-grids sharing the column axis', () => {
    const model = detectTwin(twinTable());
    expect(model).not.toBeNull();
    expect(model!.labelColumnCount).toBe(2);
    expect(model!.colHeaders).toEqual([0, 45, 90, 135, 180]);
    expect(model!.blocks.map((b) => b.label)).toEqual(['Summer', 'Winter']);

    const [summer, winter] = model!.blocks;
    expect(summer.rowHeaders).toEqual([30, 40, 50, 60, 70, 80]);
    expect(winter.rowHeaders).toEqual([20, 30, 40, 60]);
    expect(summer.matrix.length).toBe(6);
    expect(winter.matrix.length).toBe(4);
    expect(summer.matrix[0]).toEqual([18.2, 17.4, 15.9, 14.1, 13.0]);
    expect(winter.matrix[3]).toEqual([8.7, 8.2, 7.3, 6.2, 5.5]);

    // Every block matrix is rectangular: rowHeaders × colHeaders.
    for (const b of model!.blocks) {
      expect(b.matrix.length).toBe(b.rowHeaders.length);
      expect(b.dataCells.length).toBe(b.rowHeaders.length);
      for (const r of b.matrix) expect(r.length).toBe(model!.colHeaders.length);
    }
  });

  it('links each block to its live DOM cells', () => {
    const model = detectTwin(twinTable())!;
    const summer = model.blocks[0];
    expect(summer.groupCell.textContent?.trim()).toBe('Summer');
    expect(summer.rows.length).toBe(6);
    expect(summer.rowHeaderCells[0].textContent?.trim()).toBe('30');
    expect(summer.dataCells[0][0].textContent?.trim()).toBe('18.2');
  });

  it('returns null for a plain single-grid table', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
      <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
      <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
      <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
    `;
    document.body.appendChild(tbl);
    expect(detectTwin(tbl)).toBeNull();
    expect(isTwinTable(tbl)).toBe(false);
  });

  it('returns null when a single group covers the whole body', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <thead><tr><th>Season</th><th>Speed</th><th>000</th><th>045</th></tr></thead>
      <tbody>
        <tr><th rowspan="3">Summer</th><th>30</th><td>1</td><td>2</td></tr>
        <tr><th>40</th><td>3</td><td>4</td></tr>
        <tr><th>50</th><td>5</td><td>6</td></tr>
        <tr><th>60</th><td>7</td><td>8</td></tr>
      </tbody>
    `;
    document.body.appendChild(tbl);
    // Only one rowspan group, and the trailing row has no group → not a clean twin.
    expect(detectTwin(tbl)).toBeNull();
  });

  it('honours the data-gs-no-twin opt-out', () => {
    const tbl = twinTable();
    tbl.setAttribute('data-gs-no-twin', '');
    expect(detectTwin(tbl)).toBeNull();
  });

  it('returns null for a non-numeric row-header column', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <thead><tr><th>Season</th><th>Grade</th><th>000</th><th>045</th></tr></thead>
      <tbody>
        <tr><th rowspan="2">Summer</th><th>lo</th><td>1</td><td>2</td></tr>
        <tr><th>hi</th><td>3</td><td>4</td></tr>
        <tr><th rowspan="2">Winter</th><th>lo</th><td>5</td><td>6</td></tr>
        <tr><th>hi</th><td>7</td><td>8</td></tr>
      </tbody>
    `;
    document.body.appendChild(tbl);
    expect(detectTwin(tbl)).toBeNull();
  });
});
