---
trigger: always_on
---

This rule relates to the development of test data.

Our library targets legacy web content.

This means that for `<tables>`, they will not normally be broken down into `<thead>` and `<tbody>` content - they will normally just be a series of `<tr>` rows.

Our test data should replicate this pattern.