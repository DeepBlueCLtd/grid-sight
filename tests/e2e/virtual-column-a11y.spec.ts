import { test, expect } from '@playwright/test';

/**
 * Spec 012-virtual-columns SC-006: every appended virtual-column cell has a
 * non-empty accessible name. Hand-rolled audit (no `@axe-core/playwright` is
 * pinned in `package.json`); walks every `[data-gs-virtual-column]` cell and
 * fails if any are missing accessible-name content.
 */
test.describe('Virtual columns — accessibility audit', () => {
  let server: any;
  let port: number;

  test.beforeAll(async () => {
    port = 3138;
    const { preview } = await import('vite');
    server = await preview({
      preview: { port, open: false },
      build: { outDir: 'dist' },
    });
  });

  test.afterAll(async () => {
    if (server?.httpServer?.close) {
      await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    }
  });

  test('every appended cell has a non-empty accessible name', async ({ page }) => {
    await page.goto(`http://localhost:${port}/grid-sight/demo/virtual-columns.html`);
    await page.waitForFunction(() => !!(window as any).gridSight);

    await page.evaluate(() => {
      const t = document.getElementById('sales-table') as HTMLTableElement;
      const vc = (window as any).gridSight.virtualColumns;
      vc.addCumulative(t, 'weight', 'sum');
      vc.addCompare(t, 'q1', 'q4', 'abs');
      vc.addSparkline(t);
    });

    const audit = await page.evaluate(() => {
      const issues: string[] = [];
      // Helper: an element's accessible name candidate is the first of:
      // aria-label, aria-labelledby's target text, or text content.
      const name = (el: Element): string => {
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim() !== '') return ariaLabel.trim();
        const labelledBy = el.getAttribute('aria-labelledby');
        if (labelledBy) {
          const target = document.getElementById(labelledBy);
          if (target && target.textContent && target.textContent.trim() !== '') {
            return target.textContent.trim();
          }
        }
        const txt = (el.textContent ?? '').trim();
        return txt;
      };

      // Audit appended <th> + <td>.
      const cells = document.querySelectorAll('[data-gs-virtual-column]');
      cells.forEach((cell) => {
        const tag = cell.tagName.toLowerCase();
        // <td> in <tfoot> is OK to be empty (used for column alignment only).
        const inFooter = cell.closest('tfoot') !== null;
        if (inFooter) return;
        if (!name(cell)) {
          issues.push(
            `${tag}[data-gs-virtual-column="${cell.getAttribute('data-gs-virtual-column')}"]: empty accessible name`,
          );
        }
        // Sparkline <td>s contain an <svg role="img"> — that needs aria-label.
        if (cell.getAttribute('data-gs-virtual-column') === 'sparkline') {
          const svg = cell.querySelector('svg');
          if (svg && (!svg.getAttribute('aria-label') || svg.getAttribute('aria-label')!.trim() === '')) {
            issues.push('sparkline <svg> missing aria-label');
          }
        }
      });
      return issues;
    });

    expect(audit, audit.join('\n')).toEqual([]);
  });
});
