# Contract: `find-in-table` enrichment

**Id**: `find-in-table` · **Label**: "Find in table" · **Scope**: table-level
lozenge (corner cluster) · **Persisted**: no (transient query state).

## Module: `src/enrichments/find-in-table.ts`

```typescript
export interface FindController {
  /** Rebuild matches over current visible rows for `term`; resets to first. */
  search(term: string): void;
  next(): void;     // wrap-around
  prev(): void;     // wrap-around
  /** Remove all highlight classes + drop state (byte-identical). */
  clear(): void;
  matchCount(): number;
  currentOrdinal(): number; // 1-based; 0 when none
}

/** Create a controller bound to a table. */
export function createFindController(table: HTMLTableElement): FindController;

/** Remove the find lozenge + any open box + all highlights. Teardown hook. */
export function removeFindUi(table: HTMLTableElement): void;
```

- `search` reads `cellValue` over `gridCells` of the visible rows
  (case-insensitive `includes`), builds an ordered `HTMLTableCellElement[]`.
- Highlight is **cell-level**: class `gs-find-match` on every match,
  `gs-find-current` on the active one. No `<mark>` / text-node surgery.
- `next`/`prev` move `gs-find-current`, `scrollIntoView({block:'nearest'})`.

## Module: `src/ui/find-in-table-box.ts`

```typescript
/** Build the search box (input + counter + prev/next + close), wired to a
 *  FindController, using installPopupChrome for focus-trap/Escape. */
export function openFindBox(table: HTMLTableElement, anchor: HTMLElement): void;
```

Input debounced ~120 ms. Counter renders "N of M" / "0 matches".

## Registry + lozenge wiring

```typescript
// enrichment-registry.ts
{ id: 'find-in-table', label: 'Find in table', defaultOn: true, shipped: true,
  tearDown: removeFindUi }     // restores via lozenge rebuild; no apply needed

// behavior (registerEnrichment), table-level lozenge in the corner cluster
registerEnrichment({
  id: 'find-in-table',
  appliesTo: (ctx) => ctx.headerType === 'table',
  mount: (ctx) => buildLozenge({ id: 'find-in-table', label: '⌕',
    title: 'Find in table', isToggle: false,
    onClick: () => openFindBox(ctx.table, /* lozenge el */) }),
});
```

## Behaviour contract

| Given | When | Then |
|-------|------|------|
| open box | type term | all matching visible cells highlight; counter = total |
| matches exist | Next/Enter repeatedly | current advances through all, wraps, scrolls into view; Prev reverses |
| active filter | search | only visible-row cells matched/counted |
| highlighted | clear/close | all highlights removed, byte-identical |
| disabled via toggle | tearDown | lozenge + box + highlights removed, byte-identical |
