/**
 * Type-safe criteria matching utility
 * Inspired by sift.js/MongoDB query syntax with full TypeScript support
 */

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Comparison operators - only available for number | Date
 */
type ComparableOperators<T> = T extends number | Date
  ? { $gt?: T; $gte?: T; $lt?: T; $lte?: T }
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
  $eq?: T;
  $ne?: T;
  $in?: T[];
  $nin?: T[];
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
 * Array operators - only for array fields
 */
type ArrayOperators<T> = T extends (infer U)[]
  ? { $contains?: U; $size?: number }
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
      T | PrimitiveOperators<T>;

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

const OPERATOR_KEYS = new Set([
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
  "$and",
  "$or",
  "$not",
  "$where",
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

  // If value is null/undefined, other operators fail (except $exists handled above)
  if (value === null || value === undefined) {
    const otherOps = Object.keys(ops).filter((k) => k !== "$exists");
    if (otherOps.length > 0) {
      return fail(path, otherOps[0], ops[otherOps[0]], value);
    }
    return pass;
  }

  // $eq - equality
  if ("$eq" in ops) {
    const expected = ops.$eq;
    if (value instanceof Date && expected instanceof Date) {
      if (value.getTime() !== expected.getTime()) {
        return fail(path, "$eq", expected, value);
      }
    } else if (value !== expected) {
      return fail(path, "$eq", expected, value);
    }
  }

  // $ne - not equal
  if ("$ne" in ops) {
    const notExpected = ops.$ne;
    if (value instanceof Date && notExpected instanceof Date) {
      if (value.getTime() === notExpected.getTime()) {
        return fail(path, "$ne", `not ${notExpected}`, value);
      }
    } else if (value === notExpected) {
      return fail(path, "$ne", `not ${notExpected}`, value);
    }
  }

  // $gt - greater than
  if ("$gt" in ops) {
    if (typeof value === "number" && typeof ops.$gt === "number") {
      if (value <= ops.$gt) {
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
    if (typeof value === "number" && typeof ops.$gte === "number") {
      if (value < ops.$gte) {
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
    if (typeof value === "number" && typeof ops.$lt === "number") {
      if (value >= ops.$lt) {
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
    if (typeof value === "number" && typeof ops.$lte === "number") {
      if (value > ops.$lte) {
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

  // $in - value in array
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
    } else if (!arr.includes(value)) {
      return fail(path, "$in", arr, value);
    }
  }

  // $nin - value not in array
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
    } else if (arr.includes(value)) {
      return fail(path, "$nin", `not in [${arr}]`, value);
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

  // $size - array length
  if ("$size" in ops) {
    if (!Array.isArray(value)) {
      return fail(path, "$size", "array", typeof value);
    }
    if (value.length !== ops.$size) {
      return fail(path, "$size", ops.$size, value.length);
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
    // Skip logical operators
    if (OPERATOR_KEYS.has(key)) continue;

    const fieldPath = path ? `${path}.${key}` : key;
    const fieldQuery = (query as Record<string, unknown>)[key];
    const fieldValue = (item as Record<string, unknown>)[key];

    // Handle nested object queries vs operator queries
    if (fieldQuery !== null && typeof fieldQuery === "object") {
      if (isOperatorObject(fieldQuery)) {
        // It's an operator object - match against operators
        const result = matchOperators(
          fieldValue,
          fieldQuery as PrimitiveOperators<unknown>,
          fieldPath,
        );
        if (!result.matched) return result;
      } else if (!Array.isArray(fieldQuery)) {
        // It's a nested object query - recurse
        // First check if the field value exists and is an object
        if (fieldValue === null || fieldValue === undefined) {
          // Check if the nested query is just checking $exists: false
          if (
            typeof fieldQuery === "object" &&
            "$exists" in fieldQuery &&
            (fieldQuery as Record<string, unknown>).$exists === false
          ) {
            // null/undefined passes $exists: false
            continue;
          }
          return fail(fieldPath, "nested", "object", fieldValue);
        }
        if (typeof fieldValue !== "object") {
          return fail(fieldPath, "nested", "object", typeof fieldValue);
        }
        const result = matchQueryInternal(
          fieldValue as Record<string, unknown>,
          fieldQuery as Query<Record<string, unknown>>,
          fieldPath,
        );
        if (!result.matched) return result;
      } else {
        // Array - direct equality comparison
        if (!arraysEqual(fieldValue as unknown[], fieldQuery)) {
          return fail(fieldPath, "$eq (array)", fieldQuery, fieldValue);
        }
      }
    } else {
      // Direct value comparison (implicit $eq)
      if (fieldValue instanceof Date && fieldQuery instanceof Date) {
        if (fieldValue.getTime() !== fieldQuery.getTime()) {
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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// Re-export for convenience
export type { PrimitiveOperators, LogicalOperators, FieldQuery };
