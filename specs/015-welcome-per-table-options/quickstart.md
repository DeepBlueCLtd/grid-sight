# Quickstart — Per-Table Options in < 10 minutes

How to give two tables on one page different Grid-Sight features and start
states. This is the contract the welcome page itself uses.

## 1. Declare per-table options

Before loading the IIFE bundle, set `pageConfig.tables`:

```html
<script>
  window.gridSight = {
    pageConfig: {
      // Optional page-level default for any UNMATCHED table:
      enrichments: ['heatmap', 'sort', 'sliders', 'statistics'],
      // Per-table overrides, addressed by id or CSS selector:
      tables: [
        { selector: '#temps',   enrichments: ['heatmap'],          startActive: true  },
        { selector: '#lookup',  enrichments: ['sliders', 'statistics'], startActive: true },
        { selector: '#raw',     enrichments: ['sort'] /* startActive omitted → false */ },
      ],
    },
  };
</script>
<script src="grid-sight.iife.js"></script>
```

Result on load:
- `#temps` shows **only** the heatmap affordance, GS toggle already active.
- `#lookup` shows **only** sliders + statistics, GS toggle active.
- `#raw` shows **only** sort, GS toggle **inactive** (visitor clicks GS to reveal).
- Any other table on the page → the page-level `enrichments`, inactive on load
  (today's behaviour).

## 2. Address by id or by CSS selector

`selector` is any CSS selector — an id is just `#id`:

```js
{ selector: '#sales-2026',        enrichments: ['summary-row'] }   // by id
{ selector: 'table.measurements', enrichments: ['outlier'] }       // by class — all matches
{ selector: 'section.demo > table', enrichments: ['find-in-table'] } // structural
```

## 3. Precedence (what wins)

```
visitor override (URL / localStorage)  >  per-table  >  page-level  >  library defaults
```

- A visitor enrichment override still wins over per-table (unchanged contract).
- Unknown ids are silently dropped at every tier.
- A table matched by **no** entry behaves exactly as before this feature.

## 4. Start-state (the GS toggle’s initial position)

`startActive` only sets whether the **GS toggle** starts revealed — it does NOT
control whether Grid-Sight attaches to the table (the GS button is present
either way):

| `startActive` | On load |
|---------------|---------|
| `true` | enrichments revealed (as if GS was clicked) |
| `false` / omitted | GS button shown, enrichments hidden until clicked (**default**) |

Flipping the GS toggle (or the page-wide enable control off→on) returns the table
to byte-identical original markup when it goes inactive.

## 5. Opt a table out entirely

`data-gs-ignore` still wins over any selector — the table stays fully raw:

```html
<table id="reference" data-gs-ignore> … </table>
```

## 6. Verify

```bash
yarn test          # unit + storybook (resolver precedence, selector match, start-state)
yarn test:e2e      # welcome-per-table.spec.ts (two distinct sets co-resident; start-state contrast)
yarn build         # tsc + bundle; node scripts/bundle-size.js --soft  (stay < 42 KB gz)
```

Sanity checklist:
- [ ] Two tables show different lozenges at once.
- [ ] One table starts active, one starts inactive.
- [ ] An unmatched table looks exactly as it did before.
- [ ] Turning the global toggle off restores every table to raw markup.
- [ ] Page + demos work from a `file://` load (no network).
