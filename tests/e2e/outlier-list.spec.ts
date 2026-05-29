import { test, expect, type Page } from '@playwright/test';

const PORT = 3042;
const URL = `http://localhost:${PORT}/grid-sight/demo/outlier/measurements.html`;

let server: any;

test.beforeAll(async () => {
  const { preview } = await import('vite');
  server = await preview({ preview: { port: PORT, open: false }, build: { outDir: 'dist' } });
});

test.afterAll(async () => {
  if (server?.httpServer?.close) {
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
  }
});

const LOZENGE = '#tbl-measurements thead th:nth-child(2) [data-gs-lozenge-id="outlier"]';
const LIST_BTN = '#tbl-measurements thead th:nth-child(2) [data-gs-outlier-list]';

async function flagAt1Sigma(page: Page): Promise<void> {
  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.locator('.grid-sight-toggle').first().click();
  await page.waitForSelector(LOZENGE, { state: 'attached' });
  await page.locator(LOZENGE).click(); // 2σ
  await page.locator(LOZENGE).click(); // 1σ → 5 outliers
}

test.describe('US3: outliers list popup', () => {
  test('lists outliers by descending |σ| and is a labelled dialog', async ({ page }) => {
    await flagAt1Sigma(page);
    await page.locator(LIST_BTN).click();

    const popup = page.locator('.gs-outlier-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toHaveAttribute('role', 'dialog');
    await expect(popup).toHaveAttribute('aria-label', "Outliers in column 'Latency' at 1σ");

    const labels = await popup.locator('.gs-outlier-popup__label').allTextContents();
    const rows = labels.map((t) => t.split(' — ')[0]);
    // |σ|: 200(2.49) > 30(1.82) > 50(1.32) > 150(1.22) > 60(1.06).
    expect(rows).toEqual(['S15', 'S16', 'S13', 'S14', 'S11']);
  });

  test('activating an entry highlights its row and keeps the popup open', async ({ page }) => {
    await flagAt1Sigma(page);
    await page.locator(LIST_BTN).click();

    // Dispatch the click and read the (brief) highlight class synchronously in
    // the same execution turn so the ~1.2s auto-clear timer cannot race us.
    const topRowHighlighted = await page.evaluate(() => {
      const entry = document.querySelector('.gs-outlier-popup__entry') as HTMLButtonElement;
      entry.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const rows = document.querySelectorAll('#tbl-measurements tbody tr');
      // The row-label cell also hosts row-level lozenges (H/#), so match by prefix.
      const s15 = Array.from(rows).find((r) => (r.cells[0].textContent || '').trim().startsWith('S15'));
      return s15?.classList.contains('gs-outlier-row-highlight') ?? false;
    });
    expect(topRowHighlighted).toBe(true);
    await expect(page.locator('.gs-outlier-popup')).toBeVisible(); // stays open (FR-013)
  });

  test('Escape closes the popup and returns focus to the lozenge', async ({ page }) => {
    await flagAt1Sigma(page);
    await page.locator(LIST_BTN).click();
    await expect(page.locator('.gs-outlier-popup')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.gs-outlier-popup')).toHaveCount(0);
    const focusedId = await page.evaluate(
      () => document.activeElement?.getAttribute('data-gs-lozenge-id'),
    );
    expect(focusedId).toBe('outlier');
  });

  test('Shift+Enter on the lozenge opens the list (keyboard, FR-011)', async ({ page }) => {
    await flagAt1Sigma(page);
    await page.locator(LOZENGE).focus();
    await page.keyboard.press('Shift+Enter');
    await expect(page.locator('.gs-outlier-popup')).toBeVisible();
  });
});
