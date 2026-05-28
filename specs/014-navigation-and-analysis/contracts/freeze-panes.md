# Contract: `freeze-panes` enrichment

**Id**: `freeze-panes` · **Label**: "Freeze panes" · **Scope**: table-level,
auto-rendered (no lozenge) · **Persisted**: no (on/off from enabled set).

## Module: `src/enrichments/freeze-panes.ts`

```typescript
/** Tag the header row + key column and mark the table as frozen.
 *  Idempotent. No-op if the table has no grid rows. */
export function applyFreezePanes(table: HTMLTableElement): void;

/** Remove all freeze classes + injected inline backgrounds.
 *  MUST leave the table byte-identical to its pre-apply DOM. */
export function removeFreezePanes(table: HTMLTableElement): void;
```

- `applyFreezePanes` adds `gs-freeze` to the table, `gs-freeze-header` to each
  cell of `headerRow(table)`, and `gs-freeze-col` to `gridCells(row)[0]` for each
  `gridRows(table)` row (addressing layer — never `:first-child`).
- Header ∩ key cell carries both classes (corner).

## Module: `src/ui/freeze-panes-styles.ts`

```typescript
/** Inject the minified sticky stylesheet once (id gs-freeze-styles). */
export function ensureFreezeStyles(): void;
```

CSS (scoped under `.gs-freeze`): `gs-freeze-header { position:sticky; top:0;
z-index:2; background:<opaque> }`, `gs-freeze-col { position:sticky; left:0;
z-index:1; background:<opaque> }`, corner `z-index:3`. Authored pre-minified.

## Registry wiring (`src/core/enrichment-registry.ts`)

```typescript
{ id: 'freeze-panes', label: 'Freeze panes', defaultOn: true, shipped: true,
  apply: applyFreezePanes, tearDown: removeFreezePanes }
```

## Index wiring (`src/index.ts`, inside `processTable`)

```typescript
if (isEnrichmentEnabled('freeze-panes')) { try { applyFreezePanes(table); } catch (e) { void e; } }
```

## Behaviour contract

| Given | When | Then |
|-------|------|------|
| Table taller than scroll area, frozen | scroll down | header stays at top, aligned |
| Table wider than scroll area, frozen | scroll right | key column stays at left, aligned |
| Both | scroll diagonally | corner pinned, no overlap |
| No scrollable ancestor | frozen | renders identically (sticky no-op) |
| Disabled via toggle panel | tearDown | byte-identical DOM; re-enable restores w/o reload |
