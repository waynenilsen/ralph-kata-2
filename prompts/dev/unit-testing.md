# Unit Testing

Parallel tests, isolated databases, near-100% coverage. No excuses.

---

## Philosophy

> "Legacy code is code without tests."
> — Michael Feathers

Tests are not optional. They're how you prove the code works. Every function, every branch, every edge case.

### Core Principles

1. **One database per test** — SQLite files are cheap; use them for true isolation
2. **Always parallel** — Tests must run concurrently to minimize cycle time
3. **Near-100% coverage** — If it's not covered, it's not tested
4. **No exclusions** — Don't exclude code from coverage unless absolutely necessary

---

## Test Configuration

### bunfig.toml

Configure bun's test runner for coverage and parallelism:

```toml
[test]
# Always generate coverage
coverage = true

# Coverage thresholds - fail CI if not met
coverageThreshold = { line = 0.95, function = 0.95, statement = 0.95 }

# Output formats for CI and local viewing
coverageReporter = ["text", "lcov"]
coverageDir = "./coverage"

# Skip test files in coverage (they're tests, not application code)
coverageSkipTestFiles = true

# Preload test utilities
preload = ["./test/setup.ts"]
```

### Coverage Thresholds

We target **95% coverage minimum**:

| Metric | Threshold | Why |
|--------|-----------|-----|
| Lines | 95% | Every line should execute |
| Functions | 95% | Every function should be called |
| Statements | 95% | Every statement should run |

**If coverage drops below threshold, the build fails.** No exceptions.

### What NOT to Exclude

Do not add to `coveragePathIgnorePatterns` unless absolutely necessary:

- **Don't exclude:** Business logic, API routes, server actions, hooks, utilities
- **May exclude:** Generated code (Prisma client), type definitions, config files

```toml
[test]
# Only exclude truly generated/config code
coveragePathIgnorePatterns = [
  "node_modules",
  "*.config.ts",
  "*.config.js"
]
```

---

## Database Isolation

### The Problem

SQLite is a file. When tests run in parallel:
- Multiple processes try to write to the same file
- File locks cause contention
- Tests flake or fail randomly

### The Solution: One Database Per Test

Each test gets its own SQLite database file. This enables:
- **True parallelism** — No file lock contention
- **Complete isolation** — Tests can't affect each other
- **Deterministic results** — No flaky tests from shared state

### Implementation

#### Test Setup File

```typescript
// test/setup.ts
import { beforeEach, afterEach } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';

// Each test file gets a unique database
const testId = randomUUID();
const testDbPath = `./prisma/test-${testId}.db`;

// Set DATABASE_URL before Prisma client is created
process.env.DATABASE_URL = `file:${testDbPath}`;

export const prisma = new PrismaClient();

beforeEach(async () => {
  // Push schema to create tables (fast for SQLite)
  await prisma.$executeRawUnsafe(`
    -- Schema setup runs here
    -- Or use: bunx prisma db push --skip-generate
  `);
});

afterEach(async () => {
  await prisma.$disconnect();
});

// Cleanup after all tests in this file
process.on('beforeExit', async () => {
  try {
    await unlink(testDbPath);
    await unlink(`${testDbPath}-journal`).catch(() => {});
  } catch {
    // Ignore cleanup errors
  }
});
```

#### Alternative: In-Memory Databases

For pure unit tests that don't need persistence:

```typescript
// test/setup-memory.ts
import { Database } from 'bun:sqlite';

export function createTestDb(): Database {
  // :memory: creates an isolated in-memory database
  return new Database(':memory:');
}
```

#### Per-Test Database Helper

```typescript
// test/db.ts
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { unlink } from 'fs/promises';

export async function createTestDatabase() {
  const testId = randomUUID();
  const dbPath = `./prisma/test-${testId}.db`;
  const dbUrl = `file:${dbPath}`;

  // Push schema to new database
  execSync(`DATABASE_URL="${dbUrl}" bunx prisma db push --skip-generate`, {
    stdio: 'ignore',
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } },
  });

  const cleanup = async () => {
    await prisma.$disconnect();
    await unlink(dbPath).catch(() => {});
    await unlink(`${dbPath}-journal`).catch(() => {});
  };

  return { prisma, cleanup, dbPath };
}
```

#### Using in Tests

```typescript
// src/lib/users.test.ts
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestDatabase } from '@/test/db';
import { createUser, getUser } from './users';

describe('users', () => {
  let prisma: PrismaClient;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const db = await createTestDatabase();
    prisma = db.prisma;
    cleanup = db.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  test('createUser creates a user with generated id', async () => {
    const user = await createUser(prisma, {
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });

  test('getUser returns null for non-existent user', async () => {
    const user = await getUser(prisma, 'non-existent-id');
    expect(user).toBeNull();
  });
});
```

---

## Parallel Execution

### Bun Runs Tests in Parallel by Default

Bun's test runner automatically runs test files concurrently. With database isolation, this is safe and fast.

### Don't Disable Parallelism

Never use `--bail` or sequential execution for unit tests. If tests fail when run in parallel, fix the isolation problem.

**Wrong:**
```bash
# Don't do this
bun test --bail
```

**Right:**
```bash
# Let bun run tests in parallel (default)
bun test
```

### Watch Mode for Development

```bash
# Re-run tests on file changes
bun test --watch
```

---

## Coverage Commands

### Generate Coverage Report

```bash
# Run tests with coverage (configured in bunfig.toml)
bun test

# Or explicitly
bun test --coverage
```

### View Coverage

Coverage reports are generated in `./coverage/`:

- `coverage/lcov.info` — For CI tools (Codecov, Coveralls)
- Terminal output — Human-readable summary

### CI Integration

```yaml
# .github/workflows/test.yml
- name: Run tests with coverage
  run: bun test

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    file: ./coverage/lcov.info
```

---

## Writing Testable Code

### Dependency Injection for Database

Pass the Prisma client as a parameter, don't import a singleton:

**Wrong:**
```typescript
// src/lib/users.ts
import { prisma } from '@/lib/prisma';

export async function createUser(data: CreateUserInput) {
  return prisma.user.create({ data }); // Hard to test
}
```

**Right:**
```typescript
// src/lib/users.ts
import { PrismaClient } from '@prisma/client';

export async function createUser(
  prisma: PrismaClient,
  data: CreateUserInput
) {
  return prisma.user.create({ data }); // Testable with any client
}
```

### Application Layer Uses Singleton

The application code still uses the singleton, but the function is testable:

```typescript
// src/app/actions/users.ts
'use server';

import { prisma } from '@/lib/prisma';
import { createUser as createUserFn } from '@/lib/users';

export async function createUser(data: CreateUserInput) {
  return createUserFn(prisma, data);
}
```

---

## Test Organization

### File Location

Tests live next to source files:

```
src/
├── lib/
│   ├── users.ts
│   └── users.test.ts    # Test here
├── hooks/
│   ├── use-user.ts
│   └── use-user.test.ts # Test here
```

### Naming Conventions

| File | Description |
|------|-------------|
| `*.test.ts` | Unit tests (bun test) |
| `*.e2e.ts` | E2E tests (Playwright) |

### Test Structure

```typescript
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

describe('moduleName', () => {
  // Setup/teardown for this describe block
  beforeAll(async () => { /* ... */ });
  afterAll(async () => { /* ... */ });

  describe('functionName', () => {
    test('does expected thing when given valid input', () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toEqual(expected);
    });

    test('throws when given invalid input', () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

---

## Coverage Anti-Patterns

### Don't Exclude Business Logic

```toml
# WRONG - hiding untested code
coveragePathIgnorePatterns = [
  "src/lib/**",      # No! This is business logic
  "src/hooks/**",    # No! This needs tests
]
```

### Don't Write Tests Just for Coverage

Tests should verify behavior, not just execute lines:

**Wrong:**
```typescript
test('covers the function', () => {
  someFunction(); // Just calling it isn't testing
});
```

**Right:**
```typescript
test('someFunction returns expected value', () => {
  const result = someFunction(input);
  expect(result).toEqual(expectedOutput);
});
```

### Don't Skip Edge Cases

Cover error paths, not just happy paths:

```typescript
describe('divide', () => {
  test('divides two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  test('throws on division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  test('handles negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });
});
```

---

## Checklist

Before pushing:

- [ ] `bun test` passes
- [ ] Coverage meets 95% threshold
- [ ] No `coveragePathIgnorePatterns` additions without justification
- [ ] Database tests use isolated databases
- [ ] Tests run in parallel without flaking
- [ ] All branches covered (if/else, try/catch, early returns)

---

## Quick Reference

```bash
# Run all tests with coverage
bun test

# Run specific test file
bun test src/lib/users.test.ts

# Watch mode
bun test --watch

# See coverage in terminal
bun test --coverage
```

```toml
# bunfig.toml
[test]
coverage = true
coverageThreshold = { line = 0.95, function = 0.95, statement = 0.95 }
coverageReporter = ["text", "lcov"]
coverageSkipTestFiles = true
```

---

## Related

- [Test-Driven Development](./tdd.md) - TDD workflow and test-first principles
- [Project Setup](./setup.md) - bunfig.toml and test configuration
- [Frontend Architecture](./frontend.md) - Testing hooks and components
- [Implement Ticket](./implement-ticket.md) - Test requirements in ticket workflow
- [Pre-Push Cleanup](./cleanup.md) - Coverage verification before push

---

## Sources

- [Bun Test Coverage Documentation](https://bun.sh/docs/test/coverage)
- [bunfig.toml Configuration](https://bun.sh/docs/runtime/bunfig)
- [Bun SQLite Documentation](https://bun.sh/docs/api/sqlite)
- [Fast Parallel Database Tests](https://kevin.burke.dev/kevin/fast-parallel-database-tests/)
