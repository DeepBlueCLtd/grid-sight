# Contract: Curated Matrix Fixture

`public/demo/matrix/index.html` is the curated fixture carrying the **authored
column-type oracle** that catches the #48 mis-typing class (SC-002). Its shape is
a contract the strong-oracle assertions depend on.

## Page init

```html
<script>
  window.gridSight = { pageConfig: {
    enrichments: [],            // empty ⇒ offer the full registry set
    showToggleUi: true,         // matrix harness drives the real toggle panel
  } };
</script>
```

## Required table (`id="matrix-table"`)

Columns MUST include, at minimum, one of each authored kind so every enrichment
class has both an applicable and an inapplicable target:

| Header | Kind (oracle) | Why present |
|--------|---------------|-------------|
| `Sample ID` | `identifier` | Values like `S-001`, `S-002` — MUST stay text. Catches the `cleanNumericCell` regression (no summing, no spurious row slider). |
| `Assay (mg)` | `numeric` | A real numeric column — numeric enrichments act here. |
| `Status` | `categorical` | Text categories — `frequency`/`filter` apply; numeric-only enrichments show the disabled lozenge. |
| `Reading` (annotated) | `numeric` + `annotated` | A numeric column whose cells carry annotation markers — MUST keep sort/filter affordances (the second #48 regression). |
| `Notes` | `categorical` | Free text — exercises text-only paths. |

The fixture SHOULD also include enough rows (≥ 8) and at least one blank cell per
numeric column so `statistics`/`summary-row` missing-count paths are exercised.

## Oracle expectations the spec asserts

- **Identifier column**: with `summary-row` enabled and set to `sum`, the footer
  for `Sample ID` MUST NOT be a number derived from `S-001…`; sliders MUST NOT
  offer a numeric axis for it; its column lozenges are text-appropriate only.
- **Numeric columns**: numeric enrichments (`statistics`, `summary-row`, sliders,
  `outlier`, `sparkline`, `cumulative`) render active affordances/results.
- **Categorical/text columns**: numeric-only enrichments render the disabled
  lozenge (`.gs-lozenge--disabled`) and produce no active result.
- **Annotated numeric column**: still exposes `sort` and `filter` affordances and
  types as numeric for numeric enrichments.
- **Teardown**: enabling then disabling any enrichment leaves `#matrix-table`
  byte-identical; stateful enrichments also restore on toggle-off→on.

## Constitution conformance

- No network references (Principle VI) — all data inline, nav bar consistent with
  sibling demos, works from `file://`/local preview.
- Added to `public/index.html` demo index like its siblings (consistency only;
  not asserted by the matrix).
