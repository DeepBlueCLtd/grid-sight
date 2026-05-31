import { test, expect, type Page } from '@playwright/test';
import { isolateState } from './helpers/isolation';

/**
 * quickstart.md §4: when localStorage is unavailable (private mode, blocked),
 * annotating still works for the session and a single console warning notes
 * that notes won't persist — it must NOT be refused as a "storage full" quota
 * error (FR-017).
 */

const URL = '/grid-sight/demo/annotations/index.html';

test.beforeEach(async ({ page }) => {
  await isolateState(page);
});

const cell = '#tbl-revenue tbody tr[data-gs-row-key="acme"] td.num';

test('annotating works session-only when localStorage writes are blocked', async ({ page }) => {
  // Block localStorage writes before any page script runs (simulates private
  // mode / disabled storage). Use a non-quota error so it is classified as
  // unavailable, not "storage full".
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException('blocked', 'SecurityError');
    };
  });

  const warnings: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'warning' || m.type() === 'error') warnings.push(m.text());
  });

  await page.goto(URL);
  await page.waitForFunction(() => !!(window as any).gridSight);
  await page.waitForSelector(`${cell} .gs-annotation-pin`, { state: 'attached' });

  // Annotate — must succeed in-session (no quota error, popover closes, marker paints).
  await page.locator(cell).hover();
  await page.locator(`${cell} .gs-annotation-pin`).click();
  await page.locator('.gs-annotation-popover textarea').fill('session-only note');
  await page.locator('.gs-annotation-popover button', { hasText: 'Save' }).click();

  await expect(page.locator(`${cell} .gs-annotation-marker`)).toHaveCount(1);
  await expect(page.locator('.gs-annotation-popover')).toHaveCount(0); // closed, not held open by a quota error

  // Exactly one "won't persist" warning for annotations.
  const sessionWarns = warnings.filter((w) => w.includes('localStorage is unavailable'));
  expect(sessionWarns).toHaveLength(1);

  // Nothing was persisted (the write was blocked).
  const persisted = await page.evaluate(() => {
    try {
      return Object.keys(localStorage).some((k) => k.endsWith(':annotations'));
    } catch {
      return false;
    }
  });
  expect(persisted).toBe(false);
});
