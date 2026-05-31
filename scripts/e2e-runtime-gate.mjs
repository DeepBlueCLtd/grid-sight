#!/usr/bin/env node
/**
 * E2E runtime hard gate (spec 015, FR-016 / SC-009).
 *
 * Runs the full Playwright e2e suite and fails (non-zero exit) if the wall-clock
 * exceeds `E2E_BUDGET_SECONDS`. This mirrors the bundle-size ceiling philosophy
 * (Principle I): coverage may grow underneath a single explicit number until it
 * trips, at which point the team deliberately raises the budget or parallelises
 * further — rather than letting the suite slow without anyone noticing.
 *
 * Budget basis: the post-migration **parallel** baseline measured on this
 * environment was ~163 s for the full all-projects suite (chromium for every
 * spec + firefox/webkit for the cross-engine layer), 252 tests. CI runners are
 * typically slower and noisier, so the default budget carries generous headroom.
 * Override per environment with `E2E_BUDGET_SECONDS`.
 *
 * Usage:
 *   node scripts/e2e-runtime-gate.mjs            # builds via test:e2e, then gates
 *   E2E_BUDGET_SECONDS=400 node scripts/e2e-runtime-gate.mjs
 *   node scripts/e2e-runtime-gate.mjs --no-build # gate an already-built dist
 */
import { spawnSync } from 'node:child_process';

// ── Budget ────────────────────────────────────────────────────────────────
// Post-migration parallel baseline ≈ 163 s (measured 2026-05-31). Default
// budget = baseline + ~120% headroom for slower/shared CI runners. Mirrored in
// spec.md and contracts/e2e-runner.md — keep the three in sync when changing.
const DEFAULT_BUDGET_SECONDS = 360;
const budget = Number(process.env.E2E_BUDGET_SECONDS ?? DEFAULT_BUDGET_SECONDS);

if (!Number.isFinite(budget) || budget <= 0) {
  console.error(`[e2e-runtime-gate] invalid E2E_BUDGET_SECONDS: ${process.env.E2E_BUDGET_SECONDS}`);
  process.exit(2);
}

const skipBuild = process.argv.includes('--no-build');

// `test:e2e` does `vite build` then `playwright test`; `--no-build` gates a
// dist that the caller already built (e.g. a CI step that built once). The
// no-build path goes through `npx` so the playwright binary resolves even when
// it is not on PATH as a bare command.
const cmd = skipBuild ? 'npx' : 'yarn';
const args = skipBuild ? ['playwright', 'test', 'tests/e2e'] : ['test:e2e'];

console.log(
  `[e2e-runtime-gate] budget ${budget}s (E2E_BUDGET_SECONDS${
    process.env.E2E_BUDGET_SECONDS ? '' : ' default'
  }); running ${cmd} ${args.join(' ')}`,
);

const started = Date.now();
const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false });
const elapsed = (Date.now() - started) / 1000;

if (result.error) {
  console.error(`[e2e-runtime-gate] failed to launch the suite: ${result.error.message}`);
  process.exit(2);
}

const suitePassed = result.status === 0;
const withinBudget = elapsed <= budget;

console.log(
  `[e2e-runtime-gate] suite ${suitePassed ? 'PASSED' : 'FAILED'} in ${elapsed.toFixed(1)}s ` +
    `(budget ${budget}s → ${withinBudget ? 'within' : 'OVER'})`,
);

if (!suitePassed) {
  // A test failure is the primary signal; surface it as-is.
  process.exit(result.status ?? 1);
}
if (!withinBudget) {
  console.error(
    `[e2e-runtime-gate] FAIL: e2e wall-clock ${elapsed.toFixed(1)}s exceeded the ` +
      `${budget}s budget. Parallelise further or raise E2E_BUDGET_SECONDS deliberately.`,
  );
  process.exit(1);
}

console.log('[e2e-runtime-gate] OK');
