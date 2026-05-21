---
"qmatch": minor
---

Coerce numeric strings for `$gt`/`$gte`/`$lt`/`$lte`. Values like `"1000"`, `"1.5"`, `"-2"`, and `"1e5"` are now parsed via `Number()` so comparisons work against data arriving from APIs or form inputs without an upstream cast. Previously these silently failed: the type system disallowed `$gt` on `string`, but a runtime value typed as `number | string` (or `any`/`unknown`) would slip through and always return `false` with no error. Non-numeric or empty strings (`"abc"`, `""`, `"1,000"`) still do not coerce — they fail the comparison as before. Equality operators (`$eq`/`$ne`/`$in`/`$nin`) are unchanged and remain strict.
