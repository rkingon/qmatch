# qmatch

## 1.4.0

### Minor Changes

- [#9](https://github.com/rkingon/qmatch/pull/9) [`055d9e0`](https://github.com/rkingon/qmatch/commit/055d9e0d4280b82603c7d2afe831e596c890a678) Thanks [@rkingon](https://github.com/rkingon)! - `$size` now accepts a comparison operator object in addition to an exact number, so you can ask for arrays whose length matches `$gt`/`$gte`/`$lt`/`$lte`/`$eq`/`$ne`/`$in`/`$nin` — e.g. `{ genres: { $size: { $gt: 2 } } }`, `{ genres: { $size: { $gte: 1, $lte: 5 } } }`, or `{ genres: { $size: { $ne: 0 } } }` for non-empty. The existing exact-length form (`{ $size: 3 }`) is unchanged and fully backwards compatible. Comparison failures report under `<path>.$size` in `explain()`. Empty operator objects (`{ $size: {} }`) and unknown sub-operators (e.g. `{ $size: { $exists: true } }` smuggled in via `any`/`unknown`) are rejected explicitly rather than silently matching.

## 1.3.0

### Minor Changes

- [#8](https://github.com/rkingon/qmatch/pull/8) [`83306f1`](https://github.com/rkingon/qmatch/commit/83306f1a87f82ce4e643f3092cecef2e0e27f057) Thanks [@rkingon](https://github.com/rkingon)! - Coerce numeric strings for `$gt`/`$gte`/`$lt`/`$lte`. Values like `"1000"`, `"1.5"`, `"-2"`, and `"1e5"` are now parsed via `Number()` so comparisons work against data arriving from APIs or form inputs without an upstream cast. Previously these silently failed: the type system disallowed `$gt` on `string`, but a runtime value typed as `number | string` (or `any`/`unknown`) would slip through and always return `false` with no error. Non-numeric or empty strings (`"abc"`, `""`, `"1,000"`) still do not coerce — they fail the comparison as before. Equality operators (`$eq`/`$ne`/`$in`/`$nin`) are unchanged and remain strict.

## 1.2.1

### Patch Changes

- [#7](https://github.com/rkingon/qmatch/pull/7) [`7f01b13`](https://github.com/rkingon/qmatch/commit/7f01b13313927457195ff7ac7c571b443bcd76d9) Thanks [@rkingon](https://github.com/rkingon)! - Fix nested object queries silently dropping sibling field constraints when mixed with `$where`/`$and`/`$or`/`$not`. Previously `{ profile: { age: { $gte: 18 }, $where: fn } }` would only run the `$where` and ignore the `age` check, producing false positives. Now nested mixed operator + field-key shapes behave the same as at the root level: both run, regardless of key order, and `explain()` reports the failing field.

  Also fixes two latent regressions surfaced by the rewrite: `Date` instances used as field queries now do an implicit `$eq` by timestamp (previously could silently always pass at the field level), and `RegExp` instances do an implicit `$regex`.

## 1.2.0

### Minor Changes

- [#3](https://github.com/rkingon/qmatch/pull/3) [`9f73a34`](https://github.com/rkingon/qmatch/commit/9f73a34d35090c77f89030a85a5d878c96e1091e) Thanks [@rkingon](https://github.com/rkingon)! - Equality operators (`$eq`, `$ne`, `$in`, `$nin`) now handle null/undefined values with strict `===` semantics, instead of being short-circuited to a non-match.

  - `{ $eq: null }` matches `null` (previously returned false)
  - `{ $ne: true }` matches `null`, `undefined`, and `false` (previously failed on null/undefined)
  - `{ $in: [null] }` matches `null` (previously returned false)
  - `{ $nin: [true] }` matches `null`, `undefined`, and `false` (previously failed on null/undefined)

  Also fixes an inconsistency where implicit `{ field: null }` matched null values but explicit `{ field: { $eq: null } }` did not.

  **Behavior change:** callers relying on `$ne: X` / `$nin: [...]` to reject null fields will now see those rows pass. Use `$exists: true` if you want to require the field to be present.

  Strict equality means `undefined !== null` — so `$eq: null` does not match `undefined`/missing fields.

## 1.1.0

### Minor Changes

- [#1](https://github.com/rkingon/qmatch/pull/1) [`e763614`](https://github.com/rkingon/qmatch/commit/e7636141c2c3107175bdd7f10f65a972868f33a3) Thanks [@rkingon](https://github.com/rkingon)! - Add `$some` and `$every` array operators. `$some` matches when at least one array element satisfies a sub-query (equivalent to MongoDB's `$elemMatch`). `$every` matches when all elements satisfy the sub-query. Both support primitive and object arrays with full type safety.

## 1.0.3

### Patch Changes

- [`e6dc902`](https://github.com/rkingon/qmatch/commit/e6dc902a4482459fc05f3e032157688a4aac7035) Thanks [@rkingon](https://github.com/rkingon)! - upgrade npm to v11.5.1+ for OIDC trusted publishing

## 1.0.2

### Patch Changes

- [`d51d8d3`](https://github.com/rkingon/qmatch/commit/d51d8d3cb02d5a7de9397a575093dd058af5d77c) Thanks [@rkingon](https://github.com/rkingon)! - update cdcd workflow

## 1.0.1

### Patch Changes

- [`ec42afb`](https://github.com/rkingon/qmatch/commit/ec42afb181f60ad8b221db955ff313a8cc4d3e40) Thanks [@rkingon](https://github.com/rkingon)! - clean package json file

- [`ec42afb`](https://github.com/rkingon/qmatch/commit/ec42afb181f60ad8b221db955ff313a8cc4d3e40) Thanks [@rkingon](https://github.com/rkingon)! - Add GitHub Actions CI/CD workflows for automated testing and npm publishing
