import { describe, it, expect, beforeEach } from 'vitest';
import '../sparkline-column';
import { activateDirective, detachAll } from '../virtual-column';

/**
 * jsdom-relative perf smoke test for the sparkline renderer.
 * The real wall-clock budget (SC-002, < 200 ms) is enforced by the
 * Playwright run on real Chromium in T057. This test catches catastrophic
 * regressions inside the unit suite — a 1 000 × 10 fixture stays well
 * under 250 ms in jsdom on commodity hardware.
 */

function makePerfTable(rows = 1000, numericCols = 10): HTMLTableElement {
  const t = document.createElement('table');
  t.id = 'spark-perf';
  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  const labels = ['Label', ...Array.from({ length: numericCols }, (_, i) => `M${i + 1}`)];
  for (const h of labels) {
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  }
  thead.appendChild(hr);
  t.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (let r = 0; r < rows; r++) {
    const tr = document.createElement('tr');
    const cells = [`row-${r}`];
    for (let c = 0; c < numericCols; c++) {
      cells.push(String(((r + 1) * (c + 1)) % 97));
    }
    for (const v of cells) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  document.body.appendChild(t);
  return t;
}

beforeEach(() => {
  detachAll();
  document.body.innerHTML = '';
});

describe('sparkline perf smoke (jsdom)', () => {
  it('renders 1 000 rows × 10 numeric columns inside the jsdom smoke budget', () => {
    const table = makePerfTable(1000, 10);
    const start = performance.now();
    activateDirective({
      id: 'spark',
      kind: 'sparkline',
      tableEl: table,
      scale: 'per-row',
      style: 'bar',
    });
    const elapsed = performance.now() - start;
    // jsdom on commodity CI runners is ~5-10× slower than real Chromium for
    // SVG construction; the spec-level budget (SC-002, < 200 ms) is enforced
    // by the Playwright run on Chromium in T057. This smoke ceiling is here
    // to catch catastrophic regressions (e.g. O(n²) growth) without flaking
    // on slow runners.
    expect(elapsed).toBeLessThan(3000);
    // Confirm the work actually happened.
    expect(table.querySelectorAll('td[data-gs-virtual-column="sparkline"] svg').length).toBe(1000);
  });
});
