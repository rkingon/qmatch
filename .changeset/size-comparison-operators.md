---
"qmatch": minor
---

`$size` now accepts a comparison operator object in addition to an exact number, so you can ask for arrays whose length matches `$gt`/`$gte`/`$lt`/`$lte`/`$eq`/`$ne`/`$in`/`$nin` — e.g. `{ genres: { $size: { $gt: 2 } } }`, `{ genres: { $size: { $gte: 1, $lte: 5 } } }`, or `{ genres: { $size: { $ne: 0 } } }` for non-empty. The existing exact-length form (`{ $size: 3 }`) is unchanged and fully backwards compatible. Comparison failures report under `<path>.$size` in `explain()`. Empty operator objects (`{ $size: {} }`) and unknown sub-operators (e.g. `{ $size: { $exists: true } }` smuggled in via `any`/`unknown`) are rejected explicitly rather than silently matching.
