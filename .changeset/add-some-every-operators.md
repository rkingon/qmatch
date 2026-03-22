---
"qmatch": minor
---

Add `$some` and `$every` array operators. `$some` matches when at least one array element satisfies a sub-query (equivalent to MongoDB's `$elemMatch`). `$every` matches when all elements satisfy the sub-query. Both support primitive and object arrays with full type safety.
