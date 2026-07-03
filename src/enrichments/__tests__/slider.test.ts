import { describe, it, expect, beforeEach } from 'vitest';
import { addSlider, getSliders, removeAllSliders, registerFormula, clearFormula, buildAxisBinding } from '../slider';

beforeEach(() => {
  document.body.innerHTML = '';
  localStorage.clear();
  history.replaceState(null, '', location.pathname);
  // Synchronous RAF for deterministic readout updates.
  (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => { cb(0); return 1; };
  (globalThis as any).cancelAnimationFrame = () => undefined;
  removeAllSliders();
});

function buildTable(): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.id = 'tblA';
  tbl.innerHTML = `
    <tr><th></th><th>10</th><th>20</th><th>30</th></tr>
    <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
    <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
    <tr><th>3000</th><td>7</td><td>8</td><td>9</td></tr>
  `;
  document.body.appendChild(tbl);
  return tbl;
}

describe('buildAxisBinding', () => {
  it('produces a binding for a numeric monotonic axis', () => {
    const tbl = buildTable();
    const b = buildAxisBinding(tbl, 'row');
    expect(b).not.toBeNull();
    expect(b!.headerValues).toEqual([1000, 2000, 3000]);
    expect(b!.monotonicity).toBe('increasing');
  });

  it('returns null when an axis has only one value', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <tr><th></th><th>10</th></tr>
      <tr><th>1000</th><td>1</td></tr>
    `;
    document.body.appendChild(tbl);
    expect(buildAxisBinding(tbl, 'col')).toBeNull();
  });

  it('returns null for a non-monotonic axis', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <tr><th></th><th>10</th><th>20</th></tr>
      <tr><th>2000</th><td>1</td><td>2</td></tr>
      <tr><th>1000</th><td>3</td><td>4</td></tr>
      <tr><th>3000</th><td>5</td><td>6</td></tr>
    `;
    document.body.appendChild(tbl);
    expect(buildAxisBinding(tbl, 'row')).toBeNull();
  });

  it('returns null for non-numeric headers', () => {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <tr><th></th><th>red</th><th>green</th><th>blue</th></tr>
      <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
    `;
    document.body.appendChild(tbl);
    expect(buildAxisBinding(tbl, 'col')).toBeNull();
  });

  it('binds the column axis past a full-width merged banner row (permutation 1)', () => {
    // A single merged banner cell drawn above the numeric column headers; the
    // leaf header row still carries the "Speed Knots" corner + length headers.
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <thead>
        <tr><th colspan="4">Length Overall (m)</th></tr>
        <tr><th>Speed Knots</th><th>10</th><th>20</th><th>30</th></tr>
      </thead>
      <tbody>
        <tr><th>10</th><td>1</td><td>2</td><td>3</td></tr>
        <tr><th>20</th><td>4</td><td>5</td><td>6</td></tr>
        <tr><th>30</th><td>7</td><td>8</td><td>9</td></tr>
      </tbody>
    `;
    document.body.appendChild(tbl);
    const col = buildAxisBinding(tbl, 'col');
    expect(col).not.toBeNull();
    expect(col!.headerValues).toEqual([10, 20, 30]);
    const row = buildAxisBinding(tbl, 'row');
    expect(row).not.toBeNull();
    expect(row!.headerValues).toEqual([10, 20, 30]);
  });

  it('binds the column axis with a rowspan corner + banner row (permutation 2)', () => {
    // "Speed Knots" spans both header rows; the leaf row is ALL length headers
    // (no corner cell to drop) and its cells are shifted right by the rowspan.
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <thead>
        <tr><th rowspan="2">Speed Knots</th><th colspan="3">Length Overall (m)</th></tr>
        <tr><th>10</th><th>20</th><th>30</th></tr>
      </thead>
      <tbody>
        <tr><th>10</th><td>1</td><td>2</td><td>3</td></tr>
        <tr><th>20</th><td>4</td><td>5</td><td>6</td></tr>
        <tr><th>30</th><td>7</td><td>8</td><td>9</td></tr>
      </tbody>
    `;
    document.body.appendChild(tbl);
    const col = buildAxisBinding(tbl, 'col');
    expect(col).not.toBeNull();
    expect(col!.headerValues).toEqual([10, 20, 30]);
    const row = buildAxisBinding(tbl, 'row');
    expect(row).not.toBeNull();
    expect(row!.headerValues).toEqual([10, 20, 30]);
  });
});

describe('sliders on merged-header tables', () => {
  function bannerTable(): HTMLTableElement {
    const tbl = document.createElement('table');
    tbl.innerHTML = `
      <thead>
        <tr><th rowspan="2">Speed Knots</th><th colspan="3">Length Overall (m)</th></tr>
        <tr><th>10</th><th>20</th><th>30</th></tr>
      </thead>
      <tbody>
        <tr><th>10</th><td>1</td><td>2</td><td>3</td></tr>
        <tr><th>20</th><td>4</td><td>5</td><td>6</td></tr>
        <tr><th>30</th><td>7</td><td>8</td><td>9</td></tr>
      </tbody>
    `;
    document.body.appendChild(tbl);
    return tbl;
  }

  it('creates both axis sliders and interpolates on a rowspan-corner table', () => {
    const tbl = bannerTable();
    const rowCount = tbl.rows.length;
    const rowSlider = addSlider(tbl, 'row');
    const colSlider = addSlider(tbl, 'col');
    expect(getSliders(tbl).length).toBe(2);
    // Injection added a col-slider row and per-row/header slots.
    expect(tbl.querySelectorAll('[data-gs-injected]').length).toBeGreaterThan(0);
    rowSlider.setPosition(15); // between speeds 10 and 20
    colSlider.setPosition(25); // between lengths 20 and 30
    const readout = colSlider.handle.readoutInterpolated.textContent;
    expect(readout).not.toBe('—');
    expect(readout).not.toBe('');
    removeAllSliders(tbl);
    expect(getSliders(tbl).length).toBe(0);
    // Injection tears down cleanly even though the row-slider header cell was
    // inserted into the banner row spanning the whole header block: no injected
    // scaffolding remains and the original row count is restored.
    expect(tbl.querySelectorAll('[data-gs-injected]').length).toBe(0);
    expect(tbl.rows.length).toBe(rowCount);
  });
});

describe('addSlider', () => {
  it('creates a slider on a numeric axis', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    expect(s.kind).toBe('axis');
    expect(s.axis).toBe('row');
    expect(s.position).toBeGreaterThanOrEqual(1000);
    expect(s.position).toBeLessThanOrEqual(3000);
    expect(getSliders(tbl).length).toBe(1);
  });

  it('throws when the axis is not numeric', () => {
    const tbl = document.createElement('table');
    tbl.id = 'cat';
    tbl.innerHTML = `
      <tr><th></th><th>red</th><th>green</th><th>blue</th></tr>
      <tr><th>1000</th><td>1</td><td>2</td><td>3</td></tr>
      <tr><th>2000</th><td>4</td><td>5</td><td>6</td></tr>
    `;
    document.body.appendChild(tbl);
    expect(() => addSlider(tbl, 'col')).toThrow('Axis not numeric');
  });

  it('throws when adding the same slider twice', () => {
    const tbl = buildTable();
    addSlider(tbl, 'row');
    expect(() => addSlider(tbl, 'row')).toThrow('Slider already exists');
  });

  it('removeAllSliders cleans DOM and registry', () => {
    const tbl = buildTable();
    addSlider(tbl, 'row');
    addSlider(tbl, 'col');
    expect(getSliders(tbl).length).toBe(2);
    removeAllSliders(tbl);
    expect(getSliders(tbl).length).toBe(0);
    expect(document.querySelectorAll('[data-gs-slider]').length).toBe(0);
  });

  it('writes the readout via interpolation', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    s.setPosition(2000); // exact header → readout matches column-midpoint interpolation
    const readout = s.handle.readoutInterpolated.textContent;
    expect(readout).not.toBe('—');
    expect(readout).not.toBe('');
  });
});

describe('formula registration (Story 2)', () => {
  it('shows an equation readout when a formula is registered', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    expect(s.handle.readoutEquation).toBeNull();
    registerFormula(tbl, (r, c) => r + c);
    expect(s.handle.readoutEquation).not.toBeNull();
  });

  it('removes the equation readout when cleared', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, (r) => r);
    clearFormula(tbl);
    expect(s.handle.readoutEquation).toBeNull();
  });

  it('shows "—" when the formula returns non-finite', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, () => NaN);
    expect(s.handle.readoutEquation?.textContent).toBe('—');
  });

  it('shows "—" when the formula throws', () => {
    const tbl = buildTable();
    const s = addSlider(tbl, 'row');
    registerFormula(tbl, () => { throw new Error('boom'); });
    expect(s.handle.readoutEquation?.textContent).toBe('—');
  });
});
