# Per-table options

Give different tables on the same page different Grid-Sight configurations —
which enrichments each table offers, and whether its `GS` toggle starts
revealed — addressed by **id or CSS selector**. Added in spec
015-welcome-per-table-options.

This is an additive tier: a table matched by no entry behaves exactly as it did
before this feature.

## Declaring options

Per-table options ride on the existing config object — there is **no change to
`window.gridSight.init`'s signature**. Declare them before the bundle loads:

```html
<script>
  window.gridSight = {
    pageConfig: {
      // Optional page-level default for any UNMATCHED table:
      enrichments: ['heatmap', 'sort', 'sliders', 'statistics'],
      // Per-table overrides, addressed by id or CSS selector:
      tables: [
        { selector: '#temps',  enrichments: ['heatmap'],               startActive: true  },
        { selector: '#lookup', enrichments: ['sliders', 'statistics'], startActive: true  },
        { selector: '#raw',    enrichments: ['sort'] /* startActive omitted → false */ },
      ],
    },
  };
</script>
<script src="grid-sight.iife.js"></script>
```

The ESM path is symmetric: `gridSight.init({ tables: [ … ] })`.

### Fields

| Field | Required | Default | Notes |
|-------|----------|---------|-------|
| `selector` | yes | — | Any CSS selector; an id is just `#id`. Matched against `<table>` elements with `Element.matches`. |
| `enrichments` | no | fall through to the page-level set | Ids this table offers. An empty array means "offer none". Trimmed + lowercased + deduped; non-strings dropped. |
| `startActive` | no | `false` | Whether the table's `GS` toggle begins **active** (enrichments revealed). |

Malformed input never throws into the host page: a non-array `tables`, an entry
without a string `selector`, or a non-array `enrichments` is warned-and-ignored.

## Precedence

```text
visitor override (URL / localStorage)  >  per-table  >  page-level  >  library defaults
```

- A visitor enrichment override still wins over per-table (unchanged contract).
- Unknown enrichment ids are silently dropped at every tier.
- `data-gs-ignore` is absolute: an opted-out table receives no per-table config
  and no Grid-Sight UI, even if a selector would otherwise match it.

When several entries match one table, they are folded in declaration order with
**last-match-wins per field**: a later entry's `enrichments`/`startActive`
overrides an earlier one's, while a field a later entry omits leaves the prior
value standing. This lets you write a broad selector then a narrow override.

## Start-state

`startActive` only sets the **GS toggle's initial position** — it does not
control whether Grid-Sight attaches to the table (the `GS` button is present
either way):

| `startActive` | On load |
|---------------|---------|
| `true` | enrichments revealed (as if `GS` was clicked) |
| `false` / omitted | `GS` button shown, enrichments hidden until clicked (**default**) |

The programmatic start and a manual click share one code path
(`activateToggle`/`deactivateToggle`), so flipping the toggle off — or turning
the page-wide control off → on — restores byte-identical original markup. After
a global disable → enable, each table returns to its **authored** start-state.

## Notes

- No new persisted state: per-table options are author-declared config read at
  `init()`; the start-state is a load-time initial position only.
- No new runtime dependency; selector matching uses native `Element.matches`.

See the live composition on the welcome page (`public/index.html`) and the
contract in [`specs/015-welcome-per-table-options/contracts/per-table-options.md`](../specs/015-welcome-per-table-options/contracts/per-table-options.md).
