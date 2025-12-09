# qmatch

Type-safe criteria matching for TypeScript. Filter objects with MongoDB-style queries and full autocomplete.

## Installation

```bash
npm install qmatch
# or
pnpm add qmatch
# or
yarn add qmatch
```

## Quick Start

```typescript
import { match } from 'qmatch';

const isEligible = match<User>({
  age: { $gte: 18 },
  status: { $in: ['active', 'pending'] },
  profile: {
    verified: true,
  },
});

users.filter(isEligible);
```

## Features

- **Full TypeScript support** - Operators constrained by field type, autocomplete at every level
- **Nested object queries** - Zod/Prisma-style nesting with dot-path error reporting
- **Composable logic** - `$and`, `$or`, `$not` for complex criteria
- **Array.filter() compatible** - Returns predicate function `(item: T) => boolean`
- **Debuggable** - Built-in `explain()` to see why items don't match

## Usage

### Basic Matching

```typescript
import { match } from 'qmatch';

// Simple equality (implicit $eq)
const isActive = match<User>({ status: 'active' });

// Comparison operators
const adults = match<User>({ age: { $gte: 18 } });

// Multiple conditions (implicit AND)
const qualifiedLeads = match<Lead>({
  requestAmount: { $gte: 15_000 },
  loanPurpose: { $in: ['DEBT_CONSOLIDATION', 'CREDIT_CARD'] },
});

// Use with filter
const results = leads.filter(qualifiedLeads);
```

### Nested Objects

Queries support deep nesting with full autocomplete:

```typescript
const premiumArtist = match<Song>({
  album: {
    artist: {
      verified: true,
      monthlyListeners: { $gte: 1_000_000 },
    },
  },
});
```

TypeScript catches errors at compile time:

```typescript
// ❌ Error: 'veriified' does not exist on type...
match<Song>({
  album: {
    artist: {
      veriified: true,  // Typo caught!
    },
  },
});
```

### Logical Operators

```typescript
// $or - any condition matches
const highValueOrVerified = match<Lead>({
  $or: [
    { requestAmount: { $gte: 50_000 } },
    { profile: { verified: true } },
  ],
});

// $and - explicit AND (useful for nested logic)
const complex = match<Lead>({
  $and: [
    { status: 'active' },
    { $or: [
      { tier: 'premium' },
      { score: { $gte: 800 } },
    ]},
  ],
});

// $not - negation
const notPending = match<User>({
  $not: { status: 'pending' },
});
```

### Custom Functions

```typescript
// Field-level custom logic
const roundNumbers = match<Lead>({
  requestAmount: { $fn: (amt) => amt % 1000 === 0 },
});

// Query-level custom logic
const lowDTI = match<Lead>({
  $where: (lead) => {
    const dti = lead.monthlyDebt / (lead.annualIncome / 12);
    return dti < 0.43;
  },
});

// Combine with other operators
const qualified = match<Lead>({
  requestAmount: { $gte: 10_000 },
  $where: (lead) => calculateRiskScore(lead) < 50,
});
```

## Operators

### Comparison (number | Date)

| Operator | Description |
|----------|-------------|
| `$gt` | Greater than |
| `$gte` | Greater than or equal |
| `$lt` | Less than |
| `$lte` | Less than or equal |

```typescript
match<Event>({
  date: { $gte: new Date('2024-01-01'), $lt: new Date('2025-01-01') },
  attendees: { $gt: 100 },
});
```

### Equality (all types)

| Operator | Description |
|----------|-------------|
| `$eq` | Equal (implicit when passing direct value) |
| `$ne` | Not equal |
| `$in` | Value in array |
| `$nin` | Value not in array |

```typescript
match<User>({
  role: { $in: ['admin', 'moderator'] },
  status: { $ne: 'banned' },
});
```

### String

| Operator | Description |
|----------|-------------|
| `$regex` | RegExp or string pattern |

```typescript
match<User>({
  email: { $regex: /@gmail\.com$/i },
});
```

### Array

| Operator | Description |
|----------|-------------|
| `$contains` | Array includes value |
| `$size` | Array length equals |

```typescript
match<Artist>({
  genres: { $contains: 'rock', $size: 3 },
});
```

### Existence

| Operator | Description |
|----------|-------------|
| `$exists` | Field is not null/undefined |

```typescript
match<Lead>({
  referralCode: { $exists: true },
  deletedAt: { $exists: false },
});
```

### Logical

| Operator | Description |
|----------|-------------|
| `$and` | All conditions must match |
| `$or` | Any condition must match |
| `$not` | Negates a query |
| `$where` | Custom predicate function |

## Debugging with explain()

When a match fails, use `explain()` to see why:

```typescript
const isEligible = match<Lead>({
  score: { $gte: 700 },
  income: { $gte: 50_000 },
});

if (!isEligible(lead)) {
  const result = isEligible.explain(lead);
  console.log(result.failure?.message);
  // "score: $gte expected >= 700, got 650"
}
```

The `ExplainResult` contains:

```typescript
interface ExplainResult {
  matched: boolean;
  failure?: {
    path: string;      // "profile.address.zipCode"
    operator: string;  // "$gte"
    expected: unknown; // ">= 700"
    actual: unknown;   // 650
    message: string;   // Human-readable summary
  };
}
```

### Standalone explain()

You can also use `explain()` directly with a query:

```typescript
import { explain, type Query } from 'qmatch';

const query: Query<Lead> = {
  status: 'active',
  score: { $gte: 700 },
};

const result = explain(query, lead);
```

## Type Safety

Operators are constrained by field type:

```typescript
interface User {
  name: string;
  age: number;
  createdAt: Date;
  tags: string[];
}

// ✅ Valid - $gte works on numbers
match<User>({ age: { $gte: 18 } });

// ✅ Valid - $regex works on strings
match<User>({ name: { $regex: /^A/ } });

// ✅ Valid - $contains works on arrays
match<User>({ tags: { $contains: 'premium' } });

// ❌ Type error - $gte doesn't work on strings
match<User>({ name: { $gte: 'A' } });

// ❌ Type error - $regex doesn't work on numbers
match<User>({ age: { $regex: /\d+/ } });

// ❌ Type error - wrong type for $in
match<User>({ age: { $in: ['18', '21'] } });  // Should be number[]
```

## API Reference

### `match<T>(query: Query<T>): Matcher<T>`

Creates a matcher function from a query.

```typescript
const matcher = match<User>({ status: 'active' });
matcher(user);           // boolean
matcher.explain(user);   // ExplainResult
```

### `explain<T>(query: Query<T>, item: T): ExplainResult`

Standalone function to explain why an item matches or doesn't match.

```typescript
const result = explain({ status: 'active' }, user);
```

### Types

```typescript
import type { Query, Matcher, ExplainResult } from 'qmatch';

// Define queries with full type checking
const query: Query<User> = { ... };

// Matcher type for function signatures
function filterUsers(users: User[], matcher: Matcher<User>): User[] {
  return users.filter(matcher);
}
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Empty query `{}` | Matches everything |
| Empty `$or: []` | Matches nothing |
| Empty `$and: []` | Matches everything |
| Null nested object | Fails unless `$exists: false` |
| Comparison on null | Returns false |

## Contributing

Contributions are welcome! Here's how to get started:

### Setup

```bash
git clone https://github.com/rkingon/qmatch.git
cd qmatch
pnpm install
```

### Development

```bash
pnpm test        # Run tests
pnpm test:watch  # Run tests in watch mode
pnpm typecheck   # Type check
pnpm build       # Build the package
```

### Making Changes

This project uses [Changesets](https://github.com/changesets/changesets) for version management.

1. Create a branch for your changes
2. Make your changes
3. Add a changeset describing your changes:
   ```bash
   pnpm changeset
   ```
4. Select the change type:
   - `patch` - Bug fixes, documentation updates
   - `minor` - New features (backwards compatible)
   - `major` - Breaking changes
5. Write a summary of your changes
6. Commit the changeset file along with your changes
7. Open a pull request

When your PR is merged, the release workflow will automatically create a "Version Packages" PR. Once that's merged, the package is published to npm.

## License

MIT
