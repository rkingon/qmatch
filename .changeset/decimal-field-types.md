---
"qmatch": minor
---

Treat `.toNumber()`-able values (Prisma `Decimal`, decimal.js, big.js) as number fields at the type level

`toNumber()` coercion already worked at runtime for `$gt`/`$gte`/`$lt`/`$lte`, but the types didn't know about it: `IsPlainObject<Decimal>` was `true`, so a `Decimal` field resolved to `Query<Decimal>` and recursed into the instance's own properties. `{ total: { $gte: 700 } }` was a compile error against a runtime that handled it fine, and there was no escape hatch — `$fn` didn't typecheck on that field either.

Fields whose type structurally matches `{ toNumber: () => number }` now resolve to the primitive-operator branch and accept plain-number operands (the value is coerced, the operand never is). `$eq`/`$ne`/`$in`/`$nin` and the implicit `{ total: 250 }` shorthand coerce too, instead of falling through to reference equality and silently never matching. Nullable `Decimal | null` fields keep `$eq: null` and `$exists`. `explain()` renders such values via `toString()` rather than `JSON.stringify`.
