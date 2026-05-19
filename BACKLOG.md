# Backlog

Deferred work that is genuinely valuable but not part of a current feature
branch. Each entry is captured here so the rationale survives the conversation
that produced it. Newest entries on top.

Format per entry: **What** (one line) · **Why** (the concrete problem it
solves) · **Context** (enough that someone picking this up in three months
understands the motivation) · **Depends on / blocked by** (any prerequisites).

---

## Investigate `zscore` and `aggregate` in `enrichment-menu.ts`

- **What**: Decide whether `EnrichmentType` literals `'zscore'` and
  `'aggregate'` in `src/ui/enrichment-menu.ts` are dead code (delete) or
  planned future enrichments (write specs and add to the enrichment registry).
- **Why**: The 012-capability-filtering review (R-1.1) renamed every other
  `EnrichmentType` id to match the new registry vocabulary and treated these
  two as dead code on the assumption that they have no handler, no demo, and
  no spec. If either is actually planned, the call should be reversed before
  someone re-discovers them and reintroduces the inconsistency.
- **Context**: Grep for `'zscore'` and `'aggregate'` across the repo. If only
  the menu-type literal and possibly an obsolete story reference them, delete
  them outright (Development-Phase Posture waives backwards-compat). If they
  reflect a planned statistical-marker enrichment, write a spec under
  `specs/`, register the id in `src/core/enrichment-registry.ts`, and link
  back here.
- **Depends on / blocked by**: 012-capability-filtering must ship first so
  the registry exists to register new ids against.

## Per-table enrichment override

- **What**: Allow a `data-gs-enrichments="heatmap,statistics"` attribute on
  an individual `<table>` to override the page-level config for that one
  table.
- **Why**: 012-capability-filtering is scoped per-page. The minute two real
  authoring teams need two different enrichment sets on the same page (e.g.
  one categorical roster table next to one numeric lookup table on the same
  page), they will reach for this. Today the workaround is `data-gs-ignore`
  on one and a script-tag config on the other, which is heavy-handed.
- **Context**: The natural extension point is a per-table
  `EffectiveEnabledSet` derived from the page-level set ∩ the attribute's
  list (or ∪ — UX call to make at spec time). The data-model.md "Out of
  scope" section in 012-capability-filtering already names this as the
  natural extension.
- **Depends on / blocked by**: 012-capability-filtering.

## Localised registry labels

- **What**: Allow `EnrichmentRegistry.label` to be either a string (current)
  or a `{ [lang: string]: string }` map; resolve via `document.documentElement.lang`
  or `navigator.language`.
- **Why**: The runtime toggle panel and any host-page enrichment chooser
  that consumes `window.gridSight.enrichmentIds` currently show English
  labels regardless of page language. For non-English demos and customer
  deployments, this is visible polish missing.
- **Context**: Only the panel and host-page consumers read `label`; the
  identifier (`id`) stays language-neutral. Implementation is a one-function
  change in the panel + a small type widening in the registry.
- **Depends on / blocked by**: 012-capability-filtering. Customer demand for
  a non-English deployment; not worth speculative effort otherwise.

## Programmatic `setEnabled(id, bool)` API

- **What**: Expose `window.gridSight.setEnabled(id, enabled)` for host pages
  that want to build their own enrichment-chooser UI on top of the registry.
- **Why**: The runtime toggle panel shipped in 012-capability-filtering is
  intentionally opinionated — a fieldset of checkboxes. Some hosts will want
  to render their own UI (a custom switch component, an integration with a
  parent app's settings panel, etc.). Without a programmatic API they would
  have to mutate the URL fragment by hand, which works but is not the kind
  of stable contract the docs should promise.
- **Context**: The effective-enabled-set module already exposes the resolver
  and the cache; the new public method is a thin wrapper that updates the
  visitor-persisted set, calls the resolver, runs tearDowns, and rebuilds
  lozenges — exactly what the panel's `onCheckboxChange` does. The internal
  function exists; this is just promoting one symbol to the public surface.
- **Depends on / blocked by**: 012-capability-filtering shipping the
  effective-enabled-set machinery and the panel as the reference consumer.
