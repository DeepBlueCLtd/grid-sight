# Phase 0 Research: Dynamic Sliders & Interactive Examples

**Spec**: [spec.md](./spec.md) · **Plan**: [plan.md](./plan.md) · **Date**: 2026-05-01

This document records the technical decisions taken to resolve every NEEDS
CLARIFICATION marker (none remain open from the spec) and to validate the technology
choices against constitution v1.1.0.

---

## R-1 — Slider DOM primitive

**Decision**: Use the native `<input type="range">` element as the slider's
interaction primitive, with custom CSS for visual styling.

**Rationale**:
- Free keyboard handling (arrow keys, Page Up/Down, Home/End) — directly satisfies
  FR-019.
- Native ARIA role `slider` with min/max/value/now exposed automatically — directly
  satisfies FR-020 without custom plumbing.
- Pointer + touch + mouse handled by the browser; no custom drag state machine
  needed.
- Zero bundle cost.

**Alternatives considered**:
- *Custom `<div>` with Pointer Events + manual ARIA*: more flexible visual styling
  but reimplements keyboard handling and AT semantics. Rejected — costs bundle and
  test surface, and adds an a11y bug risk for no functional gain.
- *Third-party slider lib (nouislider, etc.)*: adds runtime dep (≥ 4 KB minified).
  Violates Principle I budget for a problem the platform already solves.

**Implications**: We MUST use CSS `appearance: none` and pseudo-element styling to
make the slider visually consistent across engines (WebKit/Blink/Firefox have
different default thumbs). Track-and-thumb styling is well-documented; budget ≤ 1 KB
of CSS.

---

## R-2 — Position resolution

**Decision** (per spec Q1 = C): Slider position is continuous. Set `step="any"` on the
underlying `<input type="range">`. Keyboard granularity is overridden manually
(arrow = 1% of range, PageUp/Down = 10%, Home/End = endpoints) by intercepting
`keydown` *before* the native handler when needed.

**Rationale**: `step="any"` is supported in all evergreen browsers ≤ 2 years and
gives sub-pixel resolution. The native arrow-key step is otherwise tied to `step`,
which would force discretisation. Manual key handling is small (≤ 30 lines).

**Alternatives considered**:
- *Native `step` ≈ pixel-width⁻¹ × range*: hard to compute robustly across resize.
  Rejected.

---

## R-3 — Interpolation algorithms

**Decision**:
- 1-D: linear interpolation between the two nearest header values, located via
  binary search on the sorted header array. O(log n) per slider update.
- 2-D (heatmap, Story 4): bilinear interpolation between the four surrounding cells.
- Both implemented as pure functions in `src/utils/interpolation.ts` with no DOM
  dependency, fully unit-testable.

**Rationale**: Linear and bilinear are the simplest forms that satisfy FR-005 / FR-007
and match what the reference mockup pages do. The constitution's pre-production
posture lets us extend to higher-order schemes later without backwards-compat cost
if user demand emerges.

**Alternatives considered**:
- *Cubic / spline*: better visually for sparse data but adds 1–2 KB of code and
  tuning surface. Out of scope for v1; flagged as a future enhancement.
- *Lookup-only (no interpolation between rows)*: rejected — defeats the purpose of a
  continuous slider.

---

## R-4 — Sync identity

**Decision** (per spec Q2 = A): Auto-detect sync. Two tables on the same page sync
on a given axis when the *full ordered tuple* of numeric header values on that axis
is byte-equal (after parse + unit-strip + canonicalisation). Sync is suppressed by a
`data-gs-no-sync` attribute on either table.

**Sync-key derivation** (in `src/utils/sync-key.ts`):
```
sync_key(axis) = sha-like-hash(canonicalised_header_tuple)
              OR a JSON.stringify of the parsed numbers (small enough)
```
Concretely we use `JSON.stringify(parsedNumbers)` — fast, small, no crypto API
needed (keeps the offline guarantee trivial).

**Rationale**: Auto-detection means zero markup change for the common case.
`JSON.stringify` of a parsed number array is deterministic, fast, and sidesteps
floating-point edge cases since headers are parsed once and cached.

**Edge case — non-canonical numbers**: `1000` vs `1,000` vs `1.0e3` all parse to the
same number, so they sync. Headers that fail to parse as numbers don't qualify the
axis for a slider in the first place (FR-001), so they can't accidentally sync.

**Alternatives considered**:
- *Explicit `data-gs-sync-group`*: less ergonomic, requires markup. Suppression-only
  attribute is the smallest API surface that buys explicit control.

---

## R-5 — Persistence (URL + localStorage)

**Decision**:
- URL is the source of truth at load. State is encoded in the *fragment* (`#…`) as
  a `URLSearchParams`-style string, e.g. `#gs.s=<key>:<pos01>,<key>:<pos01>,…`
  where `pos01` is a normalised 0–1 position rounded to 5 decimals.
- On every slider change, the fragment is rewritten via `history.replaceState` (no
  history pollution).
- On load, fragment is parsed first; missing entries fall back to `localStorage`
  scoped per existing GridSight URL-stem; missing both → default = midpoint of the
  axis (0.5).

**Rationale**:
- Fragment chosen over query string so that the change does not trigger any server
  round-trip in pages served behind redirects (offline-friendly, FR-021/§VI).
- 5-decimal normalised position keeps URLs readable and well under any practical URL
  length limit even with ~10 sliders.
- `replaceState` chosen so dragging a slider does not generate hundreds of history
  entries — back-button preserves "before sliders" navigation.

**Alternatives considered**:
- *Pure localStorage*: fails FR-012 (bookmarkability) and SC-003 (URL-only restore).
- *Per-slider opaque IDs in URL*: harder to debug; harder for users to construct
  URLs by hand for sharing.

---

## R-6 — Update loop & performance

**Decision**:
- Slider input handlers run synchronously and are throttled with `requestAnimationFrame`:
  multiple `input` events within one frame collapse to a single render pass.
- Synced sliders are updated in the same RAF callback to avoid two separate paints.
- Heatmap threshold recolouring uses CSS custom properties (`--gs-cell-fade`) on a
  table-level container, with cell-level `data-value` attributes; the recolour is a
  single class toggle + CSS variable update, no per-cell DOM mutation.

**Rationale**: Hits the ≤ 16 ms frame budget (SC-002) and 60 FPS sustained drag
(SC-004) on a mid-range laptop for ≤ 50×50 tables. Avoiding per-cell DOM writes is
the key win — CSS variables propagate in a single layout pass.

**Alternatives considered**:
- *MutationObserver-driven updates*: too coarse; fires after layout. Rejected.
- *requestIdleCallback*: too lazy for a drag; rejected.

---

## R-7 — Accessibility validation strategy

**Decision**:
- Each slider exposes a paired `aria-live="polite"` readout span. Updates are
  rate-limited to one announcement per 250 ms during drag to avoid AT flooding
  (FR-020). The final position on `change` (drag-end / key-release) always
  announces.
- A visually-hidden `<label>` is associated with each slider (`for=` / `id=`) so the
  AT announces "Range slider, 1000 to 21000" rather than just a number.
- Keyboard tests in Storybook interactions cover Tab focus, Arrow steps, Page steps,
  Home/End jumps.

**Rationale**: Best-effort accessibility (constitution §III) requires keyboard +
screen-reader support without forcing WCAG audit. Live-region rate limiting is the
single biggest pitfall with continuous sliders and ATs; we plan for it explicitly.

---

## R-8 — Equation-mode contract (Story 2)

**Decision**: A page registers a formula by calling
`window.gridSight.registerFormula(tableSelector, fn)` where `fn(rangeValue, slValue)`
returns a number. Grid-Sight stores the formula keyed by table and renders an
"From equation" readout alongside the "Interpolated" readout (FR-008/FR-009) when
a formula is registered.

**Rationale**: A function-pointer API is the simplest possible contract and keeps
the library free of an expression parser (which would blow the bundle budget).
Page authors who want declarative formulas can pass `new Function('r','s', '…')`
themselves.

**Alternatives considered**:
- *Inline formula DSL parsed by Grid-Sight*: rejected — adds parser, AST, eval; ~2 KB
  minimum and security surface.
- *Formula as a `data-gs-formula="..."` attribute*: convenient but forces an in-house
  parser. Same rejection.

---

## R-9 — Bundle-size budget allocation

Estimated cost (gzipped) for the new code:

| Module | Est. KB |
|---|---|
| `slider-control.ts` (DOM, drag, keyboard, ARIA) | 1.0 |
| `interpolation.ts` (1-D + 2-D pure) | 0.3 |
| `sync-key.ts` | 0.1 |
| `slider-persistence.ts` (URL + localStorage) | 0.4 |
| `slider.ts` + `slider-threshold.ts` (orchestration) | 0.6 |
| `heatmap-marker.ts` (overlay) | 0.4 |
| Slider CSS (range styling, threshold fade) | 0.4 |
| `enrichment-menu.ts` additions | 0.1 |
| **Total estimated addition** | **~3.3 KB** |

Current bundle is ~2.5 KB (per README). Estimated post-feature ~5.8 KB — well within
the 10 KB ceiling (constitution §I). Measurement task is part of `/speckit-tasks`.

---

## R-10 — Demo pages

**Decision**: Mirror the three reference mockups as offline demo pages under
`public/demo/sliders/`:
- `interpolation.html` (Story 1)
- `alternate-calc-models.html` (Story 2)
- `synced-tables.html` (Story 3)
- `heatmap.html` (Story 4)

These ship with the IIFE bundle and are the basis for the Playwright e2e suite.
They do NOT fetch any external resource (constitution §VI).

---

## Open items (none)

Every NEEDS CLARIFICATION from the spec is resolved:
- Q1 (step granularity) → R-2.
- Q2 (sync identity) → R-4.
- Q3 (heatmap threshold scope) → covered by FR-024 and accounted for in R-6 / R-9.
