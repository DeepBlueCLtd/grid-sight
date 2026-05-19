# Bundle Size Baseline (T001)

| Date | Raw KB | Gzipped KB | Gap to 10 KB constitution ceiling |
|---|---|---|---|
| 2026-05-19 | 71.73 | 19.01 | **+9.01 KB over** |

The current `dist/grid-sight.iife.js` exceeds the constitution §I 10 KB gzipped
ceiling by ~9 KB before this feature lands. Per R-11 and T001's stop-gate, the
implementation cannot flip enforcement at 10 KB without either:

1. Landing a bundle-cut PR first to bring the bundle under 10 KB, or
2. A constitution amendment with a recorded budget-raise.

**Decision (2026-05-19 — user override during implementation)**: raise the
enforced ceiling to **25 KB gzipped** for this PR, leaving the constitution
§I ceiling at 10 KB unchanged. This is an **explicit, recorded constitution
violation** — flagged inline in `scripts/bundle-size.js` — pending a separate
constitution-amendment PR that resolves the tension formally. T002 enforces
the 25 KB ceiling so subsequent feature work cannot silently bloat further;
the gap to 10 KB is the outstanding work the amendment PR must cover.

The feature's own budget (≤ 1 KB gzipped delta — SC-007) is still verified by
T041 measuring the post-feature gzipped size against the 19.01 KB baseline
above.
