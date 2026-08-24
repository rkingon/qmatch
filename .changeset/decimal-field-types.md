---
"qmatch": major
---

Treat `.toNumber()`-able values (Prisma `Decimal`, decimal.js, big.js) as number fields at the type level

`toNumber()` coercion already worked at runtime for `$gt`/`$gte`/`$lt`/`$lte`, but the types didn't know about it: `IsPlainObject<Decimal>` was `true`, so a `Decimal` field resolved to `Query<Decimal>` and recursed into the instance's own properties. `{ total: { $gte: 700 } }` was a compile error against a runtime that handled it fine, and there was no escape hatch — `$fn` didn't typecheck on that field either.

Fields whose type structurally matches `{ toNumber: () => number }` now resolve to the primitive-operator branch and accept plain-number operands (the value is coerced, the operand never is). `$eq`/`$ne`/`$in`/`$nin` and the implicit `{ total: 250 }` shorthand coerce too, instead of falling through to reference equality and silently never matching. Reference equality is still tried first, so an operand that is itself a `Decimal` keeps working. Nullable `Decimal | null` fields keep `$eq: null` and `$exists`. `explain()` renders the coerced number for such values rather than `JSON.stringify`.

**Breaking:** the match is structural, so *any* type with a `toNumber(): number` method is reclassified as a number field — not just `Decimal`. A domain object such as `Money { amount: number; currency: string; toNumber(): number }` was previously queryable as a nested object (`{ price: { currency: 'USD' } }`); that no longer typechecks, and its equality operators now compare numerically instead of by reference. Query the numeric value directly (`{ price: { $gte: 100 } }`), or drop `toNumber` from the type if you need the nested form.

Also fixes a latent hole this surfaced: a `Decimal` passed as a query *value* (`{ total: someDecimal }`) previously fell into the nested-object path, where a class instance with prototype-only methods has no own keys and so matched any object. It is now an implicit `$eq`, mirroring `Date`.
