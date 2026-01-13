# Test-Driven Development

Write tests first. Make them fail for the right reasons. Then implement.

---

## The Cycle

```
Red → Green → Refactor
```

1. **Red** - Write a failing test
2. **Green** - Write minimal code to pass
3. **Refactor** - Clean up without changing behavior

Repeat.

---

## Test Organization

### File Naming Convention

| Test Type | Extension | Location | Runner |
|-----------|-----------|----------|--------|
| Unit tests | `*.test.ts` | Next to source file | `bun test` |
| E2E tests | `*.e2e.ts` | `e2e/` directory | `playwright test` |

**Critical:** Do NOT use `.e2e.test.ts` for Playwright tests. Bun will pick them up and fail.

### Test-Near-Code Pattern

Unit tests live **next to the code they test**. Not in a separate `tests/` directory.

```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts       # Test lives here
├── hooks/
│   ├── use-user.ts
│   └── use-user.test.ts    # Test lives here
├── components/
│   └── users/
│       ├── user-card.tsx
│       └── user-card.test.ts  # Test lives here
```

**Do NOT create a `tests/` or `__tests__/` directory for unit tests.**

### E2E Tests

E2E tests are the exception. They test user flows across the entire application and live in a dedicated directory:

```
e2e/
├── auth.e2e.ts
├── dashboard.e2e.ts
└── checkout.e2e.ts
```

---

## The Critical Rule: Fail for the Right Reason

**Tests must fail because the logic is wrong, not because the code doesn't exist.**

### Wrong Way to Fail

```
ERROR: Cannot find module './userService'
ERROR: TypeError: getUserById is not a function
ERROR: Connection refused: localhost:5432
ERROR: Class 'OrderProcessor' not found
```

These are **infrastructure failures**. They tell you nothing about your logic. They waste your time debugging setup instead of design.

### Right Way to Fail

```
FAIL: Expected getUserById(1) to return { id: 1, name: 'Alice' }
      Received: null

FAIL: Expected calculateTotal([10, 20, 30]) to return 60
      Received: 0
```

This is a **logic failure**. The function exists, it runs, it returns the wrong thing. Now you implement.

---

## The Process

### Step 1: Write the Test

Create the test file next to your source file:

```typescript
// src/lib/users.test.ts
import { test, expect } from 'bun:test';
import { getUserById } from './users';

test('getUserById returns user with matching id', () => {
  const user = getUserById(1);
  expect(user).toEqual({ id: 1, name: 'Alice' });
});
```

### Step 2: Write the Signature with a Stub

Create the source file with a stub implementation:

```typescript
// src/lib/users.ts
interface User {
  id: number;
  name: string;
}

export function getUserById(id: number): User | null {
  return null;  // stub implementation
}
```

**The stub must:**
- Have the correct signature (params, return type)
- Return a constant that will fail the test
- Compile cleanly

### Step 3: Verify the Test Fails Correctly

Run the test:

```bash
bun test src/lib/users.test.ts
```

You should see:

```
FAIL: Expected { id: 1, name: 'Alice' }
      Received: null
```

**Not** `module not found`. **Not** `cannot connect to database`.

If you see an infrastructure error, fix it before proceeding. The test must call your function and fail on the return value.

### Step 4: Implement

Only now do you write the actual logic:

```typescript
// src/lib/users.ts
const users: User[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
];

export function getUserById(id: number): User | null {
  return users.find(u => u.id === id) ?? null;
}
```

### Step 5: Verify the Test Passes

```bash
bun test src/lib/users.test.ts
```

```
PASS: getUserById returns user with matching id
```

### Step 6: Refactor

Clean up. Extract. Rename. The tests protect you.

---

## Bun Test Patterns

### Basic Test

```typescript
import { test, expect } from 'bun:test';

test('adds two numbers', () => {
  expect(1 + 1).toBe(2);
});
```

### Describe Blocks

```typescript
import { describe, test, expect } from 'bun:test';

describe('calculateTotal', () => {
  test('returns 0 for empty array', () => {
    expect(calculateTotal([])).toBe(0);
  });

  test('sums all values', () => {
    expect(calculateTotal([10, 20, 30])).toBe(60);
  });
});
```

### Setup and Teardown

```typescript
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

describe('UserService', () => {
  let service: UserService;

  beforeEach(() => {
    service = new UserService();
  });

  afterEach(() => {
    service.cleanup();
  });

  test('creates user', () => {
    const user = service.create({ name: 'Alice' });
    expect(user.id).toBeDefined();
  });
});
```

### Async Tests

```typescript
import { test, expect } from 'bun:test';

test('fetches user', async () => {
  const user = await fetchUser(1);
  expect(user.name).toBe('Alice');
});
```

### Mocking

```typescript
import { test, expect, mock } from 'bun:test';

test('calls API with correct params', () => {
  const mockFetch = mock(() => Promise.resolve({ id: 1, name: 'Alice' }));

  // Use mockFetch in your code
  expect(mockFetch).toHaveBeenCalledWith('/api/users/1');
});
```

---

## Stub Patterns

### Return Constants

```typescript
function add(a: number, b: number): number {
  return 0;
}

function isValid(input: string): boolean {
  return false;
}

function fetchUser(id: string): Promise<User> {
  return Promise.resolve({ id: '', name: '' });
}
```

### Throw Not Implemented

For complex cases where a constant doesn't make sense:

```typescript
function processOrder(order: Order): Receipt {
  throw new Error('Not implemented');
}
```

The test will fail with a clear error, and the code compiles.

### Empty Collections

```typescript
function getActiveUsers(): User[] {
  return [];
}

function groupByCategory(items: Item[]): Map<string, Item[]> {
  return new Map();
}
```

---

## Testing Hooks

Hooks require React Testing Library. See [Frontend Architecture](./frontend.md) for detailed patterns.

```typescript
// src/hooks/use-user.test.ts
import { test, expect } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import { useUser } from './use-user';

test('useUser fetches user on mount', async () => {
  const { result } = renderHook(() => useUser('1'));

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => {
    expect(result.current.isLoading).toBe(false);
  });

  expect(result.current.user?.name).toBe('Alice');
});
```

---

## The Checklist

Before implementing any function body, verify:

- [ ] Test file exists **next to source file** (not in `tests/`)
- [ ] Test file uses `*.test.ts` extension
- [ ] Function/class signature is defined
- [ ] Types/interfaces are defined
- [ ] Stub returns a constant (wrong) value
- [ ] **Code compiles**
- [ ] **Test runs**
- [ ] **Test fails on assertion, not on infrastructure**

Only when all boxes are checked: implement.

---

## Why This Matters

### Trivial failures waste time

Debugging `module not found` or `connection refused` is not TDD. It's yak shaving. Get the plumbing working first.

### Correct failures validate your test

If your test passes with a stub that returns `null`, your test is broken. A properly failing test proves the test itself works.

### Signatures force design decisions

Writing `function getUserById(id: number): User | null` before implementing forces you to decide:
- What are the inputs?
- What is the return type?
- Can it fail? How?

This is the value of test-first: **interface before implementation**.

### Test-near-code aids maintenance

When a test lives next to its source file:
- You see it when you open the source
- You're reminded to update it when changing the source
- You don't have to hunt through a separate directory structure

---

## Common Mistakes

### Writing the implementation first

You wrote the function, now you're writing tests to cover it. That's test-after. You're testing what you built, not building what you tested.

### Testing against the database in unit tests

Your unit test shouldn't need SQLite running. Mock the data layer. Save integration tests for integration.

### Skipping the stub

You write the test, then immediately write the full implementation. You never saw it fail. How do you know the test works?

### Giant test lists

Don't write 50 tests before implementing anything. Write one test, stub, fail, implement, pass. Then the next.

### Putting unit tests in a `tests/` directory

Tests belong next to their source files. The only exception is E2E tests which go in `e2e/`.

---

## Quick Reference

```bash
# Run all unit tests with coverage
bun test

# Run specific test file
bun test src/lib/users.test.ts

# Run tests matching pattern
bun test --test-name-pattern "getUserById"

# Watch mode
bun test --watch

# Coverage report (configured in bunfig.toml)
bun test --coverage

# Run E2E tests (separate command)
bunx playwright test
```

**Coverage is mandatory.** See [Unit Testing](./unit-testing.md) for 95% threshold configuration.

```
1. Write test (*.test.ts next to source)
2. Write signature + stub (return constant)
3. Compile
4. Run test → fails on ASSERTION (not infrastructure)
5. Implement
6. Run test → passes
7. Refactor
8. Repeat
```

The test must fail because your logic is wrong, not because your code doesn't exist.

---

## Related

- [Unit Testing](./unit-testing.md) - Database isolation, coverage thresholds, parallelism
- [Frontend Architecture](./frontend.md) - Testing hooks and components
- [Project Setup](./setup.md) - Setting up bun test and Playwright
- [Implement Ticket](./implement-ticket.md) - Full ticket workflow that uses TDD
- [Pre-Push Cleanup](./cleanup.md) - Self-review after tests pass
