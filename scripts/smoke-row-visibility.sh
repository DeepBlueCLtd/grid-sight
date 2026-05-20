#!/usr/bin/env bash
# Quick smoke test for the row-visibility branch.
# Builds the IIFE, serves dist/ locally, runs a single Playwright probe
# against the live-enrichments demo, prints PASS/FAIL for each check.
#
# Usage: ./scripts/smoke-row-visibility.sh
# Requires: yarn, an installed Playwright chromium (yarn playwright install).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT=9123
echo "── building bundle ─────────────────────────────────────────"
yarn build >/dev/null 2>&1
echo "── starting http-server on :$PORT ─────────────────────────"
(cd dist && npx --yes http-server -p "$PORT" --silent >/dev/null 2>&1) &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; pkill -f "http-server.*$PORT" 2>/dev/null || true; rm -f .gs-smoke.mjs; }
trap cleanup EXIT
sleep 2

cat > .gs-smoke.mjs <<EOF
import { chromium } from 'playwright';
const URL = 'http://localhost:$PORT/demo/toggle/live-enrichments.html';
const checks = [];
const expect = (name, actual, predicate, expected) => {
  const ok = predicate(actual);
  checks.push({ name, ok, actual, expected });
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.locator('#mixed-table .grid-sight-toggle').click();
await page.waitForTimeout(200);

// 1. Lozenges have a single glyph (no ::before duplicate).
const sortGlyph = await page.evaluate(() => {
  const l = document.querySelector('#mixed-table [data-gs-lozenge-id="sort"]');
  return { text: l?.textContent, before: window.getComputedStyle(l, '::before').content };
});
expect('sort lozenge: single icon', sortGlyph,
  v => v.text === '↕' && v.before === 'none', "{ text: '↕', before: 'none' }");

const filterGlyph = await page.evaluate(() => {
  const l = document.querySelector('#mixed-table [data-gs-lozenge-id="filter"]');
  return { text: l?.textContent, before: window.getComputedStyle(l, '::before').content };
});
expect('filter lozenge: single icon', filterGlyph,
  v => v.text === '▽' && v.before === 'none', "{ text: '▽', before: 'none' }");

// 2. Sort on "30" column keeps the header row at the top.
await page.locator('#mixed-table tr:first-child th:nth-child(5) [data-gs-lozenge-id="sort"]').click();
await page.waitForTimeout(150);
const headerStaysTop = await page.evaluate(() => {
  const t = document.querySelector('#mixed-table');
  return Array.from(t.rows).map(r => {
    const tn = Array.from(r.cells[0].childNodes).find(n => n.nodeType === Node.TEXT_NODE);
    return ((tn?.textContent ?? '')).trim();
  });
});
expect('sort: header row stays at position 0', headerStaysTop,
  v => v[0] === '' && v.slice(1).every(s => /^\d+$/.test(s)),
  "first cell empty, rest are row labels");

// Reset sort.
await page.locator('#mixed-table tr:first-child th:nth-child(5) [data-gs-lozenge-id="sort"]').click();
await page.locator('#mixed-table tr:first-child th:nth-child(5) [data-gs-lozenge-id="sort"]').click();
await page.waitForTimeout(100);

// 3. Filter popup renders with an opaque background (CSS shipping).
await page.locator('#mixed-table tr:first-child th:nth-child(5) [data-gs-lozenge-id="filter"]').click();
await page.waitForSelector('.gs-filter-popup', { state: 'visible' });
const popupBg = await page.evaluate(() => {
  const p = document.querySelector('.gs-filter-popup');
  return window.getComputedStyle(p).backgroundColor;
});
expect('filter popup: opaque white background', popupBg,
  v => v === 'rgb(255, 255, 255)', "'rgb(255, 255, 255)'");

// 4. Apply Min=4 → rows with col-30 value < 4 dim (opacity 0.35).
await page.locator('.gs-filter-popup input[type="number"]').first().fill('4');
await page.locator('.gs-filter-popup button:has-text("Apply")').click();
await page.waitForTimeout(150);
const dimmed = await page.evaluate(() => {
  // mixed-table column "30" is the 5th cell (index 4). Row 4000 has value 3.5
  // → should be dimmed. Row 1000 has value 5.9 → should be visible.
  const t = document.querySelector('#mixed-table');
  const findRow = (label) => Array.from(t.rows).find(r => r.cells[0].textContent.startsWith(label));
  const r4000 = findRow('4000');
  const r1000 = findRow('1000');
  return {
    r4000_dimmed: r4000?.classList.contains('gs-row--dimmed'),
    r4000_opacity: window.getComputedStyle(r4000).opacity,
    r1000_dimmed: r1000?.classList.contains('gs-row--dimmed'),
    r1000_opacity: window.getComputedStyle(r1000).opacity,
  };
});
expect('filter min=4 on "30": row 4000 dims, row 1000 stays visible', dimmed,
  v => v.r4000_dimmed && parseFloat(v.r4000_opacity) < 1
    && !v.r1000_dimmed && parseFloat(v.r1000_opacity) === 1,
  '4000 dimmed @ 0.35, 1000 visible @ 1');

// Report.
let passed = 0, failed = 0;
console.log('');
for (const c of checks) {
  const mark = c.ok ? '\\u001b[32m✓\\u001b[0m PASS' : '\\u001b[31m✗\\u001b[0m FAIL';
  console.log(\`\${mark}  \${c.name}\`);
  if (!c.ok) {
    console.log(\`        expected: \${c.expected}\`);
    console.log(\`        actual:   \${JSON.stringify(c.actual)}\`);
    failed++;
  } else { passed++; }
}
console.log('');
console.log(\`\${passed}/\${checks.length} checks passed.\`);
await browser.close();
process.exit(failed > 0 ? 1 : 0);
EOF

echo "── running smoke checks ───────────────────────────────────"
node .gs-smoke.mjs
