import { test, expect } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * Spec 012-virtual-columns SC-002 / SC-003 perf check on real Chromium.
 *
 * - sparkline initial render < 200 ms on 1 000 × 10
 * - cumulative / compare initial render < 100 ms on the same fixture
 * - URL restoration visible within one rAF after first paint (SC-003)
 */
test.describe('Virtual columns — perf', () => {
  test.beforeEach(async ({ page }) => {
    await isolateState(page);
  });

  test('initial renders + URL restoration fit inside the SC-002 / SC-003 budgets', async ({ page }) => {
    await page.goto('/grid-sight/demo/virtual-columns.html');
    await page.waitForFunction(() => !!(window as any).gridSight);

    // Replace the demo table with a 1 000 × 10 fixture (one label + 10 numeric cols).
    await page.evaluate(() => {
      const existing = document.getElementById('sales-table');
      if (existing) existing.remove();
      const table = document.createElement('table');
      table.id = 'sales-table';
      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      const labels = ['Label', ...Array.from({ length: 10 }, (_, i) => `M${i + 1}`)];
      for (const h of labels) {
        const th = document.createElement('th');
        th.textContent = h;
        hr.appendChild(th);
      }
      thead.appendChild(hr);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      for (let r = 0; r < 1000; r++) {
        const tr = document.createElement('tr');
        const cells = [`row-${r}`];
        for (let c = 0; c < 10; c++) cells.push(String(((r + 1) * (c + 1)) % 97));
        for (const v of cells) {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      document.body.appendChild(table);
      // Re-init Grid-Sight so the new table gets lozenge wiring.
      (window as any).gridSight.disable();
      (window as any).gridSight.init();
    });
    await page.waitForFunction(() => !!(window as any).gridSight);

    // SC-002 budgets are quoted "on a mid-range laptop". CI runners are often
    // 5-10× slower than a fresh laptop on synchronous DOM construction, so
    // the budgets here are scaled. The spec numbers (sparkline < 200 ms,
    // cumulative / compare < 100 ms) are the laptop targets; the e2e exists
    // to catch catastrophic regressions, not jitter.
    const CI_FACTOR = 6;

    // Sparkline initial render.
    const sparkMs = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const start = performance.now();
      (window as any).gridSight.virtualColumns.addSparkline(t);
      return performance.now() - start;
    });
    expect(sparkMs).toBeLessThan(200 * CI_FACTOR);

    // Cumulative initial render.
    const cumMs = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const start = performance.now();
      (window as any).gridSight.virtualColumns.addCumulative(t, 'm1', 'sum');
      return performance.now() - start;
    });
    expect(cumMs).toBeLessThan(100 * CI_FACTOR);

    // Compare initial render.
    const cmpMs = await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const start = performance.now();
      (window as any).gridSight.virtualColumns.addCompare(t, 'm1', 'm10', 'abs');
      return performance.now() - start;
    });
    expect(cmpMs).toBeLessThan(100 * CI_FACTOR);

    // SC-003: URL restoration completes within one animation frame after first paint.
    const hash = await page.evaluate(() => location.hash);
    const restoredUrl = `/grid-sight/demo/virtual-columns.html${hash}`;
    const page2 = await page.context().newPage();
    await page2.goto(restoredUrl);
    const restoreMs = await page2.evaluate(async () => {
      // Wait for gridSight to mount.
      await new Promise<void>((res) => {
        const tick = () => ((window as any).gridSight ? res() : requestAnimationFrame(tick));
        tick();
      });
      const start = performance.now();
      await new Promise<void>((res) => {
        const check = () => {
          const t = document.getElementById('sales-table');
          if (t && t.querySelectorAll('[data-gs-virtual-column]').length > 0) res();
          else requestAnimationFrame(check);
        };
        check();
      });
      return performance.now() - start;
    });
    // One rAF on a 60 Hz monitor is ~16.7 ms; allow generous headroom for CI.
    expect(restoreMs).toBeLessThan(100);
    await page2.close();
  });
});
