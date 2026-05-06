---
"qmatch": patch
---

Fix nested object queries silently dropping sibling field constraints when mixed with `$where`/`$and`/`$or`/`$not`. Previously `{ profile: { age: { $gte: 18 }, $where: fn } }` would only run the `$where` and ignore the `age` check, producing false positives. Now nested mixed operator + field-key shapes behave the same as at the root level: both run, regardless of key order, and `explain()` reports the failing field.

Also fixes two latent regressions surfaced by the rewrite: `Date` instances used as field queries now do an implicit `$eq` by timestamp (previously could silently always pass at the field level), and `RegExp` instances do an implicit `$regex`.
