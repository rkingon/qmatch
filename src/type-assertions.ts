/**
 * Compile-only assertions for the conditional types. Not a runtime test — it is
 * excluded from vitest (no `.test.` in the name) and from the bundle (tsup only
 * follows `index.ts`), but `tsc --noEmit` typechecks it via `include: ["src"]`.
 *
 * `@ts-expect-error` is a bidirectional assertion: the build fails if the line
 * errors *or* if it stops erroring. That makes this the guard for type-level
 * regressions, which no runtime test can catch.
 */
import { match } from "./index";

interface Dec {
  toNumber(): number;
}

/** A domain object that is queryable *and* happens to expose toNumber(). */
interface Money {
  amount: number;
  currency: string;
  toNumber(): number;
}

interface Shapes {
  num: number;
  str: string;
  bool: boolean;
  date: Date;
  re: RegExp;
  arr: string[];
  nested: { inner: string };
  optNum?: number;
  optDec?: Dec;
  nullNum: number | null;
  nullDate: Date | null;
  nullDec: Dec | null;
  numOrStr: number | string;
  numOrDec: number | Dec;
  dec: Dec;
  money: Money;
}

declare const dec: Dec;

// --- primitives, unchanged by Decimal support -------------------------------
match<Shapes>({ num: { $gte: 1, $lt: 10 } });
match<Shapes>({ num: { $eq: 1, $in: [1, 2] } });
match<Shapes>({ num: 1 });
match<Shapes>({ str: { $regex: /a/, $in: ["a"] } });
match<Shapes>({ str: "a" });
match<Shapes>({ bool: { $ne: false } });
match<Shapes>({ date: { $gte: new Date(), $in: [new Date()] } });
match<Shapes>({ date: new Date() });
match<Shapes>({ re: { $exists: true } });
match<Shapes>({ arr: { $contains: "a", $size: { $gt: 1 }, $some: { $eq: "a" } } });
match<Shapes>({ arr: ["a"] });
match<Shapes>({ nested: { inner: "x" } });
match<Shapes>({ nested: { $exists: true } });
match<Shapes>({ optNum: { $gte: 1 } });
match<Shapes>({ numOrStr: { $gte: 1 } });

// Nullable comparables keep their comparison operators — this is why
// ComparableOperators must stay distributive rather than bracketed.
match<Shapes>({ nullNum: { $gte: 1 } });
match<Shapes>({ nullNum: { $eq: null } });
match<Shapes>({ nullDate: { $gte: new Date() } });
match<Shapes>({ nullDate: { $eq: null } });

// --- toNumber-able fields behave like number fields -------------------------
match<Shapes>({ dec: { $gte: 1, $lt: 10 } });
match<Shapes>({ dec: { $eq: 1, $ne: 2, $in: [1, 2], $nin: [3] } });
match<Shapes>({ dec: 250 });
match<Shapes>({ dec: { $exists: true } });
match<Shapes>({ dec: { $fn: (d) => d.toNumber() > 0 } });
// A Decimal *value* also compiles (it satisfies the all-optional operator type
// and is not a fresh literal, so excess-property checking never fires). The
// runtime treats it as an implicit $eq by number rather than a nested query.
match<Shapes>({ dec });
match<Shapes>({ optDec: { $gte: 1 } });
match<Shapes>({ nullDec: { $gte: 1 } });
match<Shapes>({ nullDec: { $eq: null } });
// A union with `number` keeps the wider operand type.
match<Shapes>({ numOrDec: { $gte: 1 } });
match<Shapes>({ numOrDec: { $eq: dec } });

// --- negatives --------------------------------------------------------------
// @ts-expect-error $regex is string-only
match<Shapes>({ num: { $regex: /a/ } });
// @ts-expect-error $in element type must match the field
match<Shapes>({ num: { $in: ["1"] } });
// @ts-expect-error comparison is not available on strings
match<Shapes>({ str: { $gte: "a" } });
// @ts-expect-error comparison is not available on arrays
match<Shapes>({ arr: { $gte: 1 } });
// @ts-expect-error typos in nested queries are still caught
match<Shapes>({ nested: { innerr: "x" } });
// @ts-expect-error operands are plain numbers; we coerce the value, never the operand
match<Shapes>({ dec: { $gte: dec } });
// @ts-expect-error string operators are not available on a numeric field
match<Shapes>({ dec: { $regex: /a/ } });
// @ts-expect-error array operators are not available on a numeric field
match<Shapes>({ dec: { $contains: 1 } });

// BREAKING (v2): an object with toNumber() is now a numeric leaf, so its other
// properties are no longer queryable. Pre-2.0 this compiled as a nested query.
// @ts-expect-error Money is treated as a number field, not a nested object
match<Shapes>({ money: { currency: "USD" } });
match<Shapes>({ money: { $gte: 100 } });
