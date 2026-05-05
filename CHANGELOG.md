# qmatch

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
