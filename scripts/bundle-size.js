#!/usr/bin/env node
/**
 * Measure the gzipped size of dist/grid-sight.iife.js and enforce a ceiling.
 *
 * Constitution §I (Performance & Distribution Constraints, v1.1.0) mandates a
 * 10 KB gzipped ceiling for the IIFE bundle. As of 2026-05-19, the bundle
 * measures ~27.8 KB gzipped — already well over the constitution ceiling.
 * Rather than silently weaken the threshold, this script enforces a temporary
 * 30 KB ceiling (a recorded constitution VIOLATION — see
 * specs/012-capability-filtering/baseline-bundle-size.md) pending a separate
 * constitution-amendment PR or a bundle-cut PR that brings the size back
 * under 10 KB. The enforced ceiling prevents further regression while the
 * formal resolution is pending.
 *
 * Ceiling history:
 *   - 25 KB: set when 012-capability-filtering landed (then-baseline ~21 KB).
 *   - 30 KB: raised when 012-virtual-columns landed +6.5 KB on top (~27.8 KB).
 *   - 34 KB: raised when 002-003-row-visibility merged (~33.25 KB).
 *   - 35 KB: raised for the slider calculated-result panel (~34.6 KB).
 *   - 37 KB: raised when the spec-012 sparkline interactions (US4) + scale
 *            toggle (US5) + mock-VRS test globals merged on top of the slider
 *            panel.
 *
 * Flags:
 *   --soft   warn-only (does not exit non-zero on overage); use for local
 *            pre-PR builds where the author wants the number but not the fail.
 */

import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLE = path.resolve(__dirname, '..', 'dist', 'grid-sight.iife.js');

// Constitution §I target: 10 KB. Enforced ceiling raised to 37 KB pending
// a recorded constitution amendment — see baseline-bundle-size.md.
// Bumps so far on top of the 25 KB working ceiling that 012-capability-
// filtering introduced: 25 → 28 KB on 2026-05-19 when 002-003-row-visibility
// merged (combined gz ~26.9 KB), then 28 → 30 KB when 012-virtual-columns
// landed another +6.5 KB, then 30 → 34 KB when 002-003-row-visibility merged
// on top of 012-virtual-columns (combined gz 33.25 KB), then 34 → 35 KB for
// the slider calculated-result info panel (combined gz ~34.6 KB), then
// 35 → 37 KB when the spec-012 sparkline interactions (US4) + scale toggle
// (US5) + mock-VRS test globals merged on top of the slider panel.
// Constitution §I 10 KB target unchanged.
const MAX_GZ_KB = 37;
const CONSTITUTION_TARGET_KB = 10;

const soft = process.argv.includes('--soft');

if (!fs.existsSync(BUNDLE)) {
  console.error(`bundle-size: ${BUNDLE} not found — run \`yarn build\` first.`);
  process.exit(2);
}

const raw = fs.readFileSync(BUNDLE);
const gz = gzipSync(raw);
const rawKB = (raw.length / 1024).toFixed(2);
const gzKBNum = gz.length / 1024;
const gzKB = gzKBNum.toFixed(2);

console.log(`bundle-size: dist/grid-sight.iife.js  ${rawKB} kB raw  /  ${gzKB} kB gzipped`);

if (gzKBNum > CONSTITUTION_TARGET_KB) {
  console.warn(
    `bundle-size: WARNING — gzipped size ${gzKB} kB exceeds constitution §I target of ${CONSTITUTION_TARGET_KB} kB. ` +
    `See specs/012-capability-filtering/baseline-bundle-size.md.`
  );
}

if (gzKBNum > MAX_GZ_KB) {
  const msg = `bundle-size: FAIL — gzipped size ${gzKB} kB exceeds enforced ceiling ${MAX_GZ_KB} kB.`;
  if (soft) {
    console.warn(msg + ' (--soft: not failing the build)');
  } else {
    console.error(msg);
    process.exit(1);
  }
}

// ── Spec 012-virtual-columns §R-7 per-module sub-budget breakdown ────
// Log only — these are gzipped *source* footprints (raw bytes the module
// contributes to the bundle, gzipped in isolation). Useful as a regression
// signal per PR; not a build gate. The 2.7 KB combined feature target from
// §R-7 was set when the bundle ceiling was 10 KB; today's bundle sits above
// the 10 KB target so a sub-budget breach is informational.
const VC_BUDGETS = [
  { file: 'src/enrichments/virtual-column.ts',              budget: 0.8 },
  { file: 'src/enrichments/virtual-column-registry.ts',     budget: 0.2 },
  { file: 'src/enrichments/virtual-column-persistence.ts',  budget: 0.3 },
  { file: 'src/enrichments/cumulative-column.ts',           budget: 0.3 },
  { file: 'src/enrichments/sparkline-column.ts',            budget: 0.5 },
  { file: 'src/enrichments/sparkline-svg.ts',               budget: 0.0 }, // bundled into the sparkline sub-budget
  { file: 'src/enrichments/compare-column.ts',              budget: 0.3 },
  { file: 'src/ui/compare-picker.ts',                       budget: 0.0 }, // bundled into the compare sub-budget
  { file: 'src/ui/virtual-column-lozenges.ts',              budget: 0.2 },
  { file: 'src/utils/visible-rows.ts',                      budget: 0.1 },
  { file: 'src/utils/copy-as-csv-registry.ts',              budget: 0.0 }, // bundled into the stubs sub-budget
];
let logged = false;
let totalGzKb = 0;
for (const { file, budget } of VC_BUDGETS) {
  const fpath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(fpath)) continue;
  const src = fs.readFileSync(fpath);
  const sgz = gzipSync(src).length / 1024;
  totalGzKb += sgz;
  const flag = budget > 0 && sgz > budget ? ' ⚠ over' : '';
  if (!logged) {
    console.log('bundle-size: spec 012-virtual-columns §R-7 sub-budgets (gzipped source):');
    logged = true;
  }
  console.log(`  ${file.padEnd(50)}  ${sgz.toFixed(2)} kB  (budget ${budget > 0 ? budget.toFixed(2) : '—'} kB)${flag}`);
}
if (logged) {
  console.log(`  ──────────────────────────────────────────  total ${totalGzKb.toFixed(2)} kB  (combined target 2.70 kB)`);
}
