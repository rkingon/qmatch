/**
 * Type-safe criteria matching utility
 * Inspired by sift.js/MongoDB query syntax with full TypeScript support
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Values that are not `number` but can produce one on demand — e.g. Prisma /
 * decimal.js `Decimal`. Matched structurally so consumers never have to import
 * a type from us, or us from them.
 */
type HasToNumber = { toNumber: () => number };

/**
 * The operand type for a field. `toNumber`-able fields are always queried with
 * a plain number (we coerce the value, never the operand), so a `Decimal` field
 * takes `{ $gte: 700 }` rather than `{ $gte: new Decimal(700) }`. Nullability is
 * carried through so `Decimal | null` still accepts `{ $eq: null }`.
 */
type Comparand<T> = [NonNullable<T>] extends [never]
  ? T
  : [NonNullable<T>] extends [HasToNumber]
    ? number | Extract<T, null | undefined>
    : T;

/**
 * Comparison operators - only available for number | Date | toNumber-able.
 * Deliberately distributive: a `number | null` field still gets `$gte` via the
 * `number` arm of the union.
 */
type ComparableOperators<T> = T extends number | Date | HasToNumber
  ? {
      $gt?: Comparand<T>;
      $gte?: Comparand<T>;
      $lt?: Comparand<T>;
      $lte?: Comparand<T>;
    }
  : object;

/**
 * String-specific operators
 */
type StringOperators<T> = T extends string
  ? { $regex?: RegExp | string }
  : object;

/**
 * Equality operators - available for all types
 */
type EqualityOperators<T> = {
  $eq?: Comparand<T>;
  $ne?: Comparand<T>;
  $in?: Comparand<T>[];
  $nin?: Comparand<T>[];
};

/**
 * Existence check operators
 */
type ExistenceOperators = {
  $exists?: boolean;
};

/**
 * Custom function operator for field-level custom logic
 */
type CustomOperator<T> = {
  $fn?: (value: T) => boolean;
};

/**
 * $size accepts either an exact length, or a comparison operator object
 * applied to the array's length. Only equality + numeric comparison ops
 * make sense for a length (no $exists/$regex/$fn/$contains/etc.), so we
 * compose the two existing aliases rather than redeclare them.
 */
type SizeOperators = EqualityOperators<number> & ComparableOperators<number>;

/**
 * Array operators - only for array fields
 */
type ArrayOperators<T> = T extends (infer U)[]
  ? {
      $contains?: U;
      $size?: number | SizeOperators;
      $some?: [IsPlainObject<NonNullable<U>>] extends [true]
        ? Query<NonNullable<U>>
        : PrimitiveOperators<U>;
      $every?: [IsPlainObject<NonNullable<U>>] extends [true]
        ? Query<NonNullable<U>>
        : PrimitiveOperators<U>;
    }
  : object;

/**
 * All operators available for primitive (non-object) fields
 */
type PrimitiveOperators<T> = EqualityOperators<T> &
  ComparableOperators<T> &
  StringOperators<T> &
  ArrayOperators<T> &
  ExistenceOperators &
  CustomOperator<T>;

/**
 * Check if a type is a plain object (not Date, Array, etc.)
 */
type IsPlainObject<T> = T extends Date
  ? false
  : T extends RegExp
    ? false
    : T extends unknown[]
      ? false
      : T extends HasToNumber
        ? false
        : T extends object
          ? true
          : false;

/**
 * Query for a single field - either:
 * - A direct value (implicit $eq)
 * - An operator object
 * - For nested objects, a recursive Query
 *
 * Note: We use [T] extends [...] to prevent union distribution
 */
type FieldQuery<T> = [T] extends [never]
  ? never
  : [IsPlainObject<NonNullable<T>>] extends [true]
    ? // Nested plain object - recurse with Query<T> OR just check existence
      Query<NonNullable<T>> | { $exists?: boolean }
    : // Primitive, Date, Array - direct value or operators
      Comparand<T> | PrimitiveOperators<T>;

/**
 * Logical operators for combining queries
 */
type LogicalOperators<T> = {
  $and?: Query<T>[];
  $or?: Query<T>[];
  $not?: Query<T>;
  $where?: (item: T) => boolean;
};

/**
 * Full query type with field queries and logical operators
 */
export type Query<T> = {
  [K in keyof T]?: FieldQuery<T[K]>;
} & LogicalOperators<T>;

/**
 * Result of a match operation - either matched or failed with details
 */
type MatchResult =
  | { matched: true }
  | {
      matched: false;
      path: string;
      operator: string;
      expected: unknown;
      actual: unknown;
    };

/**
 * Result returned by explain()
 */
export interface ExplainResult {
  matched: boolean;
  failure?: {
    path: string;
    operator: string;
    expected: unknown;
    actual: unknown;
    message: string;
  };
}

/**
 * A matcher function that can also explain why items don't match
 */
export interface Matcher<T> {
  (item: T): boolean;
  explain(item: T): ExplainResult;
}

// =============================================================================
// Operator Keys (for detection)
// =============================================================================

// Leaf operators apply to a single value (primitive, Date, or array). They are
// handled by matchOperators against the field value directly.
const LEAF_OPERATOR_KEYS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$contains",
  "$size",
  "$exists",
  "$regex",
  "$fn",
  "$some",
  "$every",
]);

// Logical operators combine queries against an object/item. They are handled by
// matchQueryInternal and can legitimately appear alongside sibling field keys.
const LOGICAL_OPERATOR_KEYS = new Set(["$and", "$or", "$not", "$where"]);

// Sub-operators allowed inside { $size: { ... } }. Anything else (or an empty
// object) is rejected so we don't silently match like the bugs fixed in #7/#8.
const SIZE_SUB_OPERATOR_KEYS = new Set([
  "$eq",
  "$ne",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
]);

const OPERATOR_KEYS = new Set([
  ...LEAF_OPERATOR_KEYS,
  ...LOGICAL_OPERATOR_KEYS,
]);

// =============================================================================
// Helper Functions
// =============================================================================

/** Helper to create a failure result */
function fail(
  path: string,
  operator: string,
  expected: unknown,
  actual: unknown,
): MatchResult {
  return { matched: false, path, operator, expected, actual };
}

/** Helper to create a success result */
const pass: MatchResult = { matched: true };

/**
 * Check if an object is an operator object (has any $ keys)
 */
function isOperatorObject(obj: unknown): boolean {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }
  return Object.keys(obj).some((key) => key.startsWith("$"));
}

function hasToNumber(
  value: unknown,
): value is { toNumber: () => unknown } {
  return (
    value != null &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    // Coerce numeric strings (e.g. "1000", "1.5", "-2", "1e5") so that
    // values arriving from APIs/forms still work with $gt/$gte/$lt/$lte.
    // Empty/whitespace-only and non-finite strings ("", "abc", "Infinity")
    // return null and fall through to a normal mismatch.
    if (value.trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (hasToNumber(value)) {
    const n = value.toNumber();
    return typeof n === "number" && Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Equality against a plain-number operand for `toNumber`-able values (e.g.
 * `Decimal`). Reference equality is tried first so an operand that is itself a
 * `Decimal` keeps the pre-coercion behavior it had on union-typed fields.
 * Values that don't coerce never match, so callers fall through to a normal
 * mismatch rather than throwing.
 */
function toNumberEquals(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  const n = toNumber(value);
  return n !== null && n === expected;
}

/**
 * Match a value against primitive operators
 */
function matchOperators<T>(
  value: T,
  operators: PrimitiveOperators<T>,
  path: string,
): MatchResult {
  const ops = operators as Record<string, unknown>;

  // $exists - check if value is not null/undefined
  if ("$exists" in ops) {
    const exists = value !== null && value !== undefined;
    if (ops.$exists !== exists) {
      return fail(path, "$exists", ops.$exists, exists);
    }
  }

  // Equality operators ($eq, $ne, $in, $nin) are handled before the
  // null/undefined short-circuit so that e.g. { $eq: null } matches a
  // null value, { $ne: true } matches null, etc. They use strict ===
  // semantics, matching JS equality (undefined !== null).
  if ("$eq" in ops) {
    const expected = ops.$eq;
    if (value instanceof Date && expected instanceof Date) {
      if (value.getTime() !== expected.getTime()) {
        return fail(path, "$eq", expected, value);
      }
    } else if (hasToNumber(value)) {
      if (!toNumberEquals(value, expected)) {
        return fail(path, "$eq", expected, value);
      }
    } else if (value !== expected) {
      return fail(path, "$eq", expected, value);
    }
  }

  if ("$ne" in ops) {
    const notExpected = ops.$ne;
    if (value instanceof Date && notExpected instanceof Date) {
      if (value.getTime() === notExpected.getTime()) {
        return fail(path, "$ne", `not ${notExpected}`, value);
      }
    } else if (hasToNumber(value)) {
      if (toNumberEquals(value, notExpected)) {
        return fail(path, "$ne", `not ${notExpected}`, value);
      }
    } else if (value === notExpected) {
      return fail(path, "$ne", `not ${notExpected}`, value);
    }
  }

  if ("$in" in ops) {
    const arr = ops.$in;
    if (!Array.isArray(arr)) {
      return fail(path, "$in", "array", typeof arr);
    }
    if (value instanceof Date) {
      const time = value.getTime();
      if (!arr.some((d) => d instanceof Date && d.getTime() === time)) {
        return fail(path, "$in", arr, value);
      }
    } else if (hasToNumber(value)) {
      if (!arr.some((n) => toNumberEquals(value, n))) {
        return fail(path, "$in", arr, value);
      }
    } else if (!arr.includes(value)) {
      return fail(path, "$in", arr, value);
    }
  }

  if ("$nin" in ops) {
    const arr = ops.$nin;
    if (!Array.isArray(arr)) {
      return fail(path, "$nin", "array", typeof arr);
    }
    if (value instanceof Date) {
      const time = value.getTime();
      if (arr.some((d) => d instanceof Date && d.getTime() === time)) {
        return fail(path, "$nin", `not in [${arr}]`, value);
      }
    } else if (hasToNumber(value)) {
      if (arr.some((n) => toNumberEquals(value, n))) {
        return fail(path, "$nin", `not in [${arr}]`, value);
      }
    } else if (arr.includes(value)) {
      return fail(path, "$nin", `not in [${arr}]`, value);
    }
  }

  // If value is null/undefined, remaining operators fail. Equality
  // operators ($eq, $ne, $in, $nin) and $exists are handled above.
  if (value === null || value === undefined) {
    const otherOps = Object.keys(ops).filter(
      (k) =>
        k !== "$exists" &&
        k !== "$eq" &&
        k !== "$ne" &&
        k !== "$in" &&
        k !== "$nin",
    );
    if (otherOps.length > 0) {
      return fail(path, otherOps[0], ops[otherOps[0]], value);
    }
    return pass;
  }

  // $gt - greater than
  if ("$gt" in ops) {
    const numVal = toNumber(value);
    if (numVal !== null && typeof ops.$gt === "number") {
      if (numVal <= ops.$gt) {
        return fail(path, "$gt", `> ${ops.$gt}`, value);
      }
    } else if (value instanceof Date && ops.$gt instanceof Date) {
      if (value.getTime() <= ops.$gt.getTime()) {
        return fail(path, "$gt", `> ${ops.$gt.toISOString()}`, value);
      }
    } else {
      return fail(path, "$gt", `> ${ops.$gt}`, value);
    }
  }

  // $gte - greater than or equal
  if ("$gte" in ops) {
    const numVal = toNumber(value);
    if (numVal !== null && typeof ops.$gte === "number") {
      if (numVal < ops.$gte) {
        return fail(path, "$gte", `>= ${ops.$gte}`, value);
      }
    } else if (value instanceof Date && ops.$gte instanceof Date) {
      if (value.getTime() < ops.$gte.getTime()) {
        return fail(path, "$gte", `>= ${ops.$gte.toISOString()}`, value);
      }
    } else {
      return fail(path, "$gte", `>= ${ops.$gte}`, value);
    }
  }

  // $lt - less than
  if ("$lt" in ops) {
    const numVal = toNumber(value);
    if (numVal !== null && typeof ops.$lt === "number") {
      if (numVal >= ops.$lt) {
        return fail(path, "$lt", `< ${ops.$lt}`, value);
      }
    } else if (value instanceof Date && ops.$lt instanceof Date) {
      if (value.getTime() >= ops.$lt.getTime()) {
        return fail(path, "$lt", `< ${ops.$lt.toISOString()}`, value);
      }
    } else {
      return fail(path, "$lt", `< ${ops.$lt}`, value);
    }
  }

  // $lte - less than or equal
  if ("$lte" in ops) {
    const numVal = toNumber(value);
    if (numVal !== null && typeof ops.$lte === "number") {
      if (numVal > ops.$lte) {
        return fail(path, "$lte", `<= ${ops.$lte}`, value);
      }
    } else if (value instanceof Date && ops.$lte instanceof Date) {
      if (value.getTime() > ops.$lte.getTime()) {
        return fail(path, "$lte", `<= ${ops.$lte.toISOString()}`, value);
      }
    } else {
      return fail(path, "$lte", `<= ${ops.$lte}`, value);
    }
  }

  // $contains - array contains value
  if ("$contains" in ops) {
    if (!Array.isArray(value)) {
      return fail(path, "$contains", "array", typeof value);
    }
    const needle = ops.$contains;
    if (!value.includes(needle)) {
      return fail(path, "$contains", `contains ${needle}`, value);
    }
  }

  // $size - array length. Accepts either an exact number (matches
  // value.length === N) or a comparison object like { $gt: 3, $lte: 10 }
  // applied to the length. Empty objects and unknown sub-operators are
  // rejected — silently passing them would reintroduce the #7/#8 bug
  // class (operators slipping through with no error).
  if ("$size" in ops) {
    if (!Array.isArray(value)) {
      return fail(path, "$size", "array", typeof value);
    }
    const sizeQuery = ops.$size;
    if (typeof sizeQuery === "number") {
      if (value.length !== sizeQuery) {
        return fail(path, "$size", sizeQuery, value.length);
      }
    } else if (
      sizeQuery !== null &&
      typeof sizeQuery === "object" &&
      !Array.isArray(sizeQuery)
    ) {
      const subKeys = Object.keys(sizeQuery as Record<string, unknown>);
      if (subKeys.length === 0) {
        return fail(
          path,
          "$size",
          "non-empty operator object",
          sizeQuery,
        );
      }
      const unknown = subKeys.find((k) => !SIZE_SUB_OPERATOR_KEYS.has(k));
      if (unknown !== undefined) {
        return fail(
          `${path}.$size`,
          unknown,
          `one of ${[...SIZE_SUB_OPERATOR_KEYS].join(", ")}`,
          unknown,
        );
      }
      const result = matchOperators(
        value.length,
        sizeQuery as PrimitiveOperators<number>,
        `${path}.$size`,
      );
      if (!result.matched) return result;
    } else {
      return fail(path, "$size", "number or operator object", typeof sizeQuery);
    }
  }

  // $some - at least one array element matches
  if ("$some" in ops) {
    if (!Array.isArray(value)) {
      return fail(path, "$some", "array", typeof value);
    }
    const subQuery = ops.$some;
    const anyMatch = value.some((element, i) => {
      if (
        element !== null &&
        typeof element === "object" &&
        !Array.isArray(element) &&
        !(element instanceof Date)
      ) {
        return matchQueryInternal(
          element as Record<string, unknown>,
          subQuery as Query<Record<string, unknown>>,
          `${path}[${i}]`,
        ).matched;
      }
      if (isOperatorObject(subQuery)) {
        return matchOperators(
          element,
          subQuery as PrimitiveOperators<unknown>,
          `${path}[${i}]`,
        ).matched;
      }
      return element === subQuery;
    });
    if (!anyMatch) {
      return fail(path, "$some", "at least one element to match", value);
    }
  }

  // $every - all array elements must match
  if ("$every" in ops) {
    if (!Array.isArray(value)) {
      return fail(path, "$every", "array", typeof value);
    }
    const subQuery = ops.$every;
    for (let i = 0; i < value.length; i++) {
      const element = value[i];
      let result: MatchResult;
      if (
        element !== null &&
        typeof element === "object" &&
        !Array.isArray(element) &&
        !(element instanceof Date)
      ) {
        result = matchQueryInternal(
          element as Record<string, unknown>,
          subQuery as Query<Record<string, unknown>>,
          `${path}[${i}]`,
        );
      } else if (isOperatorObject(subQuery)) {
        result = matchOperators(
          element,
          subQuery as PrimitiveOperators<unknown>,
          `${path}[${i}]`,
        );
      } else {
        result =
          element === subQuery
            ? pass
            : fail(`${path}[${i}]`, "$every", subQuery, element);
      }
      if (!result.matched) return result;
    }
  }

  // $regex - regular expression match (strings only)
  if ("$regex" in ops) {
    if (typeof value !== "string") {
      return fail(path, "$regex", "string", typeof value);
    }
    const pattern = ops.$regex;
    if (pattern instanceof RegExp) {
      if (!pattern.test(value)) {
        return fail(path, "$regex", pattern.toString(), value);
      }
    } else if (typeof pattern === "string") {
      if (!new RegExp(pattern).test(value)) {
        return fail(path, "$regex", pattern, value);
      }
    } else {
      return fail(path, "$regex", "RegExp or string", typeof pattern);
    }
  }

  // $fn - custom function
  if ("$fn" in ops) {
    const fn = ops.$fn;
    if (typeof fn !== "function") {
      return fail(path, "$fn", "function", typeof fn);
    }
    if (!fn(value)) {
      return fail(path, "$fn", "custom function to return true", value);
    }
  }

  return pass;
}

/**
 * Match an item against a full query (recursive)
 */
function matchQueryInternal<T extends object>(
  item: T,
  query: Query<T>,
  path: string,
): MatchResult {
  // Handle $where first (query-level custom function)
  if ("$where" in query) {
    const fn = query.$where;
    if (typeof fn === "function" && !fn(item)) {
      return fail(path || "(root)", "$where", "function to return true", false);
    }
  }

  // Handle $and - all must match
  if ("$and" in query) {
    const conditions = query.$and;
    if (Array.isArray(conditions) && conditions.length > 0) {
      for (let i = 0; i < conditions.length; i++) {
        const result = matchQueryInternal(
          item,
          conditions[i],
          `${path}$and[${i}]`,
        );
        if (!result.matched) return result;
      }
    }
  }

  // Handle $or - at least one must match
  if ("$or" in query) {
    const conditions = query.$or;
    if (Array.isArray(conditions)) {
      if (conditions.length === 0) {
        return fail(
          path || "(root)",
          "$or",
          "at least one condition",
          "empty array",
        );
      }
      const anyMatch = conditions.some(
        (q) => matchQueryInternal(item, q, "").matched,
      );
      if (!anyMatch) {
        return fail(
          path || "(root)",
          "$or",
          "at least one condition to match",
          "none matched",
        );
      }
    }
  }

  // Handle $not - negation
  if ("$not" in query) {
    const notQuery = query.$not;
    if (notQuery && matchQueryInternal(item, notQuery, "").matched) {
      return fail(
        path || "(root)",
        "$not",
        "condition to NOT match",
        "it matched",
      );
    }
  }

  // Handle field queries (implicit AND)
  for (const key of Object.keys(query)) {
    // Skip operator keys; they're handled above ($and/$or/$not/$where) or
    // per-field below (leaf operators get split out into matchOperators).
    if (OPERATOR_KEYS.has(key)) continue;

    const fieldPath = path ? `${path}.${key}` : key;
    const fieldQuery = (query as Record<string, unknown>)[key];
    const fieldValue = (item as Record<string, unknown>)[key];

    // Handle nested object queries vs operator queries
    if (fieldQuery !== null && typeof fieldQuery === "object") {
      if (Array.isArray(fieldQuery)) {
        // Array - direct equality comparison
        if (!arraysEqual(fieldValue as unknown[], fieldQuery)) {
          return fail(fieldPath, "$eq (array)", fieldQuery, fieldValue);
        }
      } else if (fieldQuery instanceof Date) {
        // Date instance - implicit $eq by timestamp
        if (
          !(fieldValue instanceof Date) ||
          fieldValue.getTime() !== fieldQuery.getTime()
        ) {
          return fail(fieldPath, "$eq (implicit)", fieldQuery, fieldValue);
        }
      } else if (fieldQuery instanceof RegExp) {
        // RegExp instance - implicit $regex against a string field
        if (typeof fieldValue !== "string" || !fieldQuery.test(fieldValue)) {
          return fail(
            fieldPath,
            "$regex (implicit)",
            fieldQuery.toString(),
            fieldValue,
          );
        }
      } else {
        // Plain object query: split into leaf operators (applied to the
        // field value directly) and the rest (sibling field keys + logical
        // operators, applied by recursing into matchQueryInternal). This
        // lets a single nested object query mix e.g. { $gte: 18 } on age
        // with a sibling { $where } without silently dropping either piece.
        const fq = fieldQuery as Record<string, unknown>;
        const leafOps: Record<string, unknown> = {};
        const restQuery: Record<string, unknown> = {};
        let hasLeafOps = false;
        let hasRest = false;
        for (const k of Object.keys(fq)) {
          if (LEAF_OPERATOR_KEYS.has(k)) {
            leafOps[k] = fq[k];
            hasLeafOps = true;
          } else {
            restQuery[k] = fq[k];
            hasRest = true;
          }
        }

        if (hasLeafOps) {
          const result = matchOperators(
            fieldValue,
            leafOps as PrimitiveOperators<unknown>,
            fieldPath,
          );
          if (!result.matched) return result;
        }

        // For everything except a pure leaf-op query, the field value must
        // be a non-null object (sibling field keys and logical operators
        // are object-shaped, and an empty {} query still expects an object
        // — consistent with Mongo semantics for { field: {} }).
        if (hasRest || !hasLeafOps) {
          if (fieldValue === null || fieldValue === undefined) {
            return fail(fieldPath, "nested", "object", fieldValue);
          }
          if (typeof fieldValue !== "object") {
            return fail(fieldPath, "nested", "object", typeof fieldValue);
          }
        }

        if (hasRest) {
          const result = matchQueryInternal(
            fieldValue as Record<string, unknown>,
            restQuery as Query<Record<string, unknown>>,
            fieldPath,
          );
          if (!result.matched) return result;
        }
      }
    } else {
      // Direct value comparison (implicit $eq)
      if (fieldValue instanceof Date && fieldQuery instanceof Date) {
        if (fieldValue.getTime() !== fieldQuery.getTime()) {
          return fail(fieldPath, "$eq (implicit)", fieldQuery, fieldValue);
        }
      } else if (hasToNumber(fieldValue)) {
        if (!toNumberEquals(fieldValue, fieldQuery)) {
          return fail(fieldPath, "$eq (implicit)", fieldQuery, fieldValue);
        }
      } else if (fieldValue !== fieldQuery) {
        return fail(fieldPath, "$eq (implicit)", fieldQuery, fieldValue);
      }
    }
  }

  return pass;
}

/**
 * Simple array equality check
 */
function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((val, i) => val === b[i]);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a matcher function from a query
 *
 * @example
 * ```typescript
 * const isHighValue = match<Lead>({
 *   PersonalLoanLead: {
 *     requestAmount: { $gte: 15000 },
 *   },
 * });
 *
 * leads.filter(isHighValue);
 *
 * // Explain why an item didn't match
 * if (!isHighValue(lead)) {
 *   const result = isHighValue.explain(lead);
 *   console.log(result.failure?.message);
 * }
 * ```
 */
export function match<T extends object>(query: Query<T>): Matcher<T> {
  const matcher = (item: T) => matchQueryInternal(item, query, "").matched;
  matcher.explain = (item: T) => explain(query, item);
  return matcher;
}

/**
 * Explain why a query matched or didn't match an item
 *
 * @example
 * ```typescript
 * const result = explain({ status: 'active', score: { $gte: 100 } }, item);
 * if (!result.matched) {
 *   console.log(result.failure.message);
 *   // "score: $gte expected >= 100, got 50"
 * }
 * ```
 */
export function explain<T extends object>(
  query: Query<T>,
  item: T,
): ExplainResult {
  const result = matchQueryInternal(item, query, "");

  if (result.matched) {
    return { matched: true };
  }

  return {
    matched: false,
    failure: {
      path: result.path,
      operator: result.operator,
      expected: result.expected,
      actual: result.actual,
      message: `${result.path}: ${result.operator} expected ${formatValue(result.expected)}, got ${formatValue(result.actual)}`,
    },
  };
}

/**
 * Format a value for display in error messages
 */
function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    if (value.length > 3) {
      return `[${value.slice(0, 3).map(formatValue).join(", ")}, ...]`;
    }
    return `[${value.map(formatValue).join(", ")}]`;
  }
  if (typeof value === "string") return `"${value}"`;
  if (hasToNumber(value)) {
    // Render what we actually compared, not the instance — String() on a bare
    // { toNumber } gives "[object Object]".
    const n = toNumber(value);
    if (n !== null) return String(n);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Re-export for convenience
export type { PrimitiveOperators, LogicalOperators, FieldQuery };
