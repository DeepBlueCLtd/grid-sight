# Adding (or shipping) an enrichment

A checklist of **every** touch-point a new enrichment must cover before it is
"done". It exists because enrichments fail in integration, not in isolation:
the logic and unit tests are the easy 80%; the surfaces below are the 20% that
gets silently skipped and ships half-wired.

Treat this as a copy-into-the-PR checklist. If an item genuinely does not apply
(e.g. a stateless enrichment with no persistence), write `N/A — <reason>` next
to it rather than deleting it, so a reviewer can see it was considered.

> Spec-process note: when you write `tasks.md` for an enrichment, every section
> below should map to at least one task. If it doesn't, the task list is
> incomplete — fix the plan before implementing, not after.

---

## 1. Registry (the single source of truth)

- [ ] Added/updated the entry in `src/core/enrichment-registry.ts`
      (`id`, `label`, `defaultOn`).
- [ ] On first ship: flipped `shipped: false → true`.
- [ ] Provided a **`tearDown(table)`** that restores **byte-identical** DOM
      (no leftover classes, attributes, injected nodes, or empty `class=""`).
- [ ] If the enrichment renders state automatically (markers, injected columns,
      persisted UI) rather than only on a user click, provided an
      **`apply(table)`** path that can run *again* after teardown — see §3.
      (Stateless, click-triggered enrichments restore via lozenge rebuild and
      do not need this.)
- [ ] `id` is lower-case, hyphen-separated, unique. Boot-time validation in the
      registry passes.

## 2. Apply wiring (`src/index.ts`)

- [ ] `apply<Feature>(table)` is called for every processed table inside
      `processTable`, gated on `isEnrichmentEnabled('<id>')`.
- [ ] Any **page-level** init (menu entries, URL/hash hint consumers) runs once
      in `init()` after tables are processed — **and** is re-run when the
      relevant state changes (see §3), not only at init.
- [ ] `disable()` removes all of this feature's DOM (so the global disable path
      is byte-identical, not just the per-enrichment toggle).

## 3. Enable → disable → enable round-trip (the most-missed item)

- [ ] Toggling the enrichment **off then on** via the spec-012 toggle panel
      fully restores it **without a page reload**. The panel runs `tearDown` on
      disable and rebuilds lozenges on enable; **it does not re-run your
      `apply` unless you wire it** (registry `apply` hook / panel re-apply).
      Stateful enrichments (auto-rendered markers, persisted notes, injected
      columns) MUST handle this explicitly.
- [ ] Any "appears only when X exists" page-level affordance updates live when X
      first appears / last disappears (e.g. on save/delete), not only at init.

## 4. Capability surfaces — no parallel id lists

"Which enrichments exist" must not drift across files. Reconcile **all** of:

- [ ] `ENRICHMENT_REGISTRY` (§1) — the canonical list.
- [ ] `EnrichmentType` union + `ENRICHMENT_ITEMS` in `src/ui/enrichment-menu.ts`
      — **only if** the feature is triggered from the per-column/header `+`
      menu. Cell-level or page-level features legitimately stay out; if you add
      it, the union and the items list must agree with the registry id.
- [ ] Hardcoded `pageConfig.enrichments` arrays in demo pages under `public/`
      (there are several — grep `enrichments: \[`). Add the new id where the
      demo should offer it, especially the landing page `public/index.html`.
- [ ] If you find yourself maintaining the same id in N places by hand, prefer
      deriving from the registry (or add a unit test asserting the subset
      relationship) so future drift fails CI instead of shipping silently.

## 5. Persistence (if the feature stores anything)

- [ ] Reuses the `gs:` per-URL-stem scheme (`storageKeyFor`/`urlStem` in
      `src/utils/slider-persistence.ts`) with a distinct suffix.
- [ ] All `localStorage` access is wrapped in `try/catch`; unavailable storage
      degrades to session-only with **one** `console.warn` per page, never a
      throw into the host page.
- [ ] Versioned envelope; malformed/legacy payloads are skipped, not migrated
      (during development-phase posture).
- [ ] No network on any runtime path; works from `file://` and offline.

## 6. Accessibility (constitution §III) — actually verify, don't assume

- [ ] Keyboard-operable end to end (Tab-reachable, Enter/Space/Escape as
      appropriate); focus is managed for any popup (reuse `installPopupChrome`).
- [ ] Accessible names / ARIA wired (and any injected ARIA node is removed on
      teardown; don't clobber an author's existing `aria-*`).
- [ ] **Colour is not the sole signal** — confirmed in an actual grayscale /
      monochrome simulation, not by assertion.
- [ ] If a task says "screen-reader pass", it means run one. Automated DOM
      assertions are a proxy, not a substitute — see §10.

## 7. Bundle budget (constitution §I)

- [ ] Know the feature's gzipped budget **before** coding and measure
      incrementally with `node scripts/bundle-size.js --soft`, not only when
      `yarn build` fails.
- [ ] CSS lives in a minified injected `<style data-gs-…-styles>` string
      (terser does not minify string literals — collapse whitespace at source).
- [ ] If over budget: trim first. If raising the enforced ceiling is the
      accepted call, record it in `scripts/bundle-size.js` (ceiling history) and
      `specs/012-capability-filtering/baseline-bundle-size.md`, and call it out
      explicitly in the PR — it's a recorded constitution violation.

## 8. Tests (constitution §II)

- [ ] Vitest unit tests for the core logic (and persistence codec round-trip /
      malformed / quota / unavailable, if applicable).
- [ ] jsdom interaction tests for the UI (affordance reveal, keyboard contract,
      teardown leaves byte-identical DOM).
- [ ] A Storybook story in `src/stories/<feature>.stories.ts` (visual +
      interaction coverage) — the storybook vitest project runs its `play`.
- [ ] Playwright e2e for the golden path, **plus**:
  - [ ] persistence survives reload (if persisted),
  - [ ] state survives sort/filter reorder (if positioned),
  - [ ] **enable → disable → enable round-trip restores without reload** (§3).
- [ ] Updated any existing test that hardcodes the shipped-enrichment count /
      id list (e.g. `capability-filtering-toggle.spec.ts`,
      `enrichment-registry.test.ts`). If such a test breaks, treat it as a
      drift signal (§4), not just a number to bump.
- [ ] `yarn test` (unit + storybook) and `yarn test:e2e` both green.

## 9. Demo (a shipped capability needs a demo)

- [ ] A dedicated child page `public/demo/<feature>/index.html` that showcases
      the feature with instructions and a realistic table.
- [ ] A demo card linking it from the landing page `public/index.html`.
- [ ] A nav link consistent with the other demo pages' nav bar.
- [ ] The demo's `pageConfig.enrichments` actually includes the new id.
- [ ] Smoke-tested in a real browser (not only jsdom) — at minimum the golden
      path works on the demo page.

## 10. Docs & task hygiene

- [ ] `tasks.md` items are checked `[X]` **only if actually performed**.
      Manual/qualitative tasks (a11y pass, manual quickstart run) are not
      satisfied by automated proxies — if you used a proxy, say so and leave the
      manual task open rather than marking it done.
- [ ] Quickstart / spec docs updated if behaviour diverged from the plan.
- [ ] This checklist, pasted into the PR with each item ticked or marked `N/A`.

---

## Why each item exists (failure log)

These are real misses from shipped enrichments. Keep adding to it.

- **006 cell-annotations**: shipped with no demo (§9); the "Show annotations"
  entry only registered at page init so it didn't appear after the first note
  until reload (§3); toggle OFF→ON did not restore markers because there is no
  re-apply hook (§3); the `EnrichmentType` union / demo allow-lists were not
  reconciled (§4); the bundle overran its ≤2 KB budget and was only caught when
  the build failed (§7); the a11y and manual-quickstart tasks were marked done
  without being performed (§6, §10).
- **`EnrichmentType` union** in `enrichment-menu.ts` has been missing `sort` and
  `filter` since they shipped — evidence that §4 drift is the default failure
  mode, not a one-off.
