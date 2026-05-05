---
"qmatch": minor
---

Equality operators (`$eq`, `$ne`, `$in`, `$nin`) now handle null/undefined values with strict `===` semantics, instead of being short-circuited to a non-match.

- `{ $eq: null }` matches `null` (previously returned false)
- `{ $ne: true }` matches `null`, `undefined`, and `false` (previously failed on null/undefined)
- `{ $in: [null] }` matches `null` (previously returned false)
- `{ $nin: [true] }` matches `null`, `undefined`, and `false` (previously failed on null/undefined)

Also fixes an inconsistency where implicit `{ field: null }` matched null values but explicit `{ field: { $eq: null } }` did not.

**Behavior change:** callers relying on `$ne: X` / `$nin: [...]` to reject null fields will now see those rows pass. Use `$exists: true` if you want to require the field to be present.

Strict equality means `undefined !== null` — so `$eq: null` does not match `undefined`/missing fields.
