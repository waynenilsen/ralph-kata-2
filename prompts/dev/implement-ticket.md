# Implementing a Ticket

The process from ticket to merged code. Follow this every time.

---

## Before You Start

### 1. Verify the Foundation

Before writing any feature code, confirm the project is set up correctly. See [Project Setup](./setup.md).

```bash
bun run check      # format + lint passes
bun run docs       # TypeDoc compiles
bun test           # unit tests pass
bun run test:e2e   # e2e tests pass
bun run build      # build succeeds
```

**If any of these fail, fix them first.** Don't build on a broken foundation.

### 2. Move the Ticket to In Progress

**Before writing any code, move the ticket to "in progress".**

```bash
# View the ticket
gh issue view <number>

# Move to in progress
gh issue edit <number> --add-label "in progress"
```

This is not optional. Moving the ticket signals to the team that work has begun and prevents duplicate effort.

**All ticket operations must use `gh` CLI.** Do not update tickets through the GitHub web UI during development.

### 3. Understand the Ticket

Read the ticket completely. Ask questions before coding, not after.

- What is the expected behavior?
- What are the edge cases?
- What are the acceptance criteria?
- Are there design specs or mocks?

If anything is unclear, clarify with the ticket author. Assumptions lead to rework.

---

## The Implementation Cycle

Follow [Test-Driven Development](./tdd.md) principles.

### Step 1: Write a Failing Test

Create the test file **next to the source file** (not in a `tests/` directory):

```typescript
// src/lib/users.test.ts
import { test, expect } from 'bun:test';
import { createUser } from './users';

test('createUser returns user with generated id', () => {
  const user = createUser({ name: 'Alice', email: 'alice@example.com' });
  expect(user.id).toBeDefined();
  expect(user.name).toBe('Alice');
});
```

### Step 2: Write the Stub

Create the function signature with a stub implementation:

```typescript
// src/lib/users.ts
import type { User, CreateUserInput } from '@/types';

export function createUser(input: CreateUserInput): User {
  return { id: '', name: '', email: '', createdAt: new Date() }; // stub
}
```

### Step 3: Verify the Test Fails Correctly

```bash
bun test src/lib/users.test.ts
```

The test should fail on the **assertion**, not on infrastructure:

```
✗ Expected user.name to be 'Alice', received ''
```

**Not** `Cannot find module` or `function is not defined`.

### Step 4: Implement

Write the minimal code to make the test pass:

```typescript
// src/lib/users.ts
import { prisma } from '@/lib/prisma';
import type { User, CreateUserInput } from '@/types';

export async function createUser(input: CreateUserInput): Promise<User> {
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
    },
  });
}
```

### Step 5: Run All Tests

```bash
bun test
```

Your new test should pass. But you're not done.

---

## Handling Failing Tests

**Every test must pass. No exceptions.**

When you see a failing test, there are two possibilities:

### Possibility 1: Your Code Broke It

Your new code changed behavior that another test depends on. This is your bug to fix.

**Common causes:**
- Changed a function signature
- Modified shared state
- Altered return values
- Changed database schema (Prisma)
- Updated API responses

**How to fix:**
1. Read the failing test - understand what it expects
2. Trace why your change affected it
3. Either update your implementation or update the test (if the old expectation is now wrong)

### Possibility 2: It Was Already Broken

The test was failing before you started. This is still your job to fix.

**Why it's your responsibility:**
- You can't merge with a broken build
- You touched the codebase, you own it
- Leaving broken tests is technical debt

**How to fix:**
1. Check if it's a flaky test (run it a few times)
2. Read the test and the code it tests
3. Fix the code or fix the test

**Do not:**
- Skip the test
- Mark it as `.todo()`
- Merge with failing tests
- Assume someone else will fix it

### The Rule

**If a test is failing when you run the suite, fix it.** It doesn't matter who broke it or when. A green build is required to merge.

---

## After Implementation

### 1. Run the Full Suite

```bash
bun run check       # format + lint
bun run docs        # TypeDoc compiles
bun test            # all unit tests
bun run test:e2e    # all e2e tests
bun run build       # production build
```

All must pass.

### 2. Self-Review

Follow [Pre-Push Cleanup](./cleanup.md).

```bash
git add -A
git diff --staged
```

Check for:
- Debug statements (`console.log`, `debugger`)
- Commented-out code
- Hardcoded values that should be constants
- Missing error handling
- Copy-pasted code that should be extracted
- Unused variables or imports
- Tests in wrong location (should be next to source, not in `tests/`)

### 3. Commit

Follow [Conventional Commits](./conventional-commits.md).

```bash
git commit -m "$(cat <<'EOF'
feat(users): add createUser function

- src/lib/users.ts: add createUser function with Prisma
- src/lib/users.test.ts: add tests for createUser
- src/types/user.ts: add CreateUserInput interface

Closes #<ticket-number>

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Always include `Closes #<number>`** when the commit completes a ticket. See [Conventional Commits](./conventional-commits.md#closing-tickets).

### 4. Push and Verify CI

```bash
git push
```

Watch CI. If it fails, fix it before doing anything else.

### 5. Update the Ticket

Use GitHub CLI to update ticket status:

```bash
# Remove in-progress, add ready-for-review
gh issue edit <number> --remove-label "in progress" --add-label "ready for review"

# Or close if complete
gh issue close <number>

# Add a comment with the PR link
gh issue comment <number> --body "Implemented in #<pr-number>"
```

---

## File Organization Reminder

### Unit Tests: Next to Source

```
src/
├── lib/
│   ├── users.ts
│   └── users.test.ts      # ✓ Correct
├── hooks/
│   ├── use-user.ts
│   └── use-user.test.ts   # ✓ Correct
```

**NOT:**
```
tests/
├── lib/
│   └── users.test.ts      # ✗ Wrong - don't create tests/ directory
```

### E2E Tests: Dedicated Directory

```
e2e/
├── auth.e2e.ts           # ✓ Uses .e2e.ts extension
├── users.e2e.ts
```

**NOT:**
```
e2e/
├── auth.e2e.test.ts       # ✗ Wrong - bun will pick this up
```

---

## The Checklist

Before marking a ticket as done:

- [ ] All acceptance criteria are met
- [ ] Tests exist for new functionality
- [ ] Tests are next to source files (`*.test.ts`)
- [ ] E2E tests use `*.e2e.ts` in `e2e/` directory
- [ ] Coverage meets 95% threshold (see [Unit Testing](./unit-testing.md))
- [ ] `bun run check` passes
- [ ] `bun run docs` passes
- [ ] `bun test` passes (with coverage)
- [ ] `bun run test:e2e` passes
- [ ] `bun run build` passes
- [ ] No debug statements in code
- [ ] No commented-out code
- [ ] Commit message follows convention
- [ ] CI is green
- [ ] Ticket updated via `gh` CLI

---

## Quick Reference

```bash
# Before starting
gh issue view <number>
gh issue edit <number> --add-label "in progress"
bun run check && bun run docs && bun test && bun run test:e2e && bun run build

# TDD cycle
# 1. Write test (next to source file)
# 2. Write stub
# 3. Verify correct failure
# 4. Implement
# 5. Verify pass

# After implementation
bun run check
bun run docs
bun test
bun run test:e2e
bun run build
git add -A
git diff --staged  # self-review
git commit -m "feat(scope): description"
git push

# Update ticket
gh issue edit <number> --remove-label "in progress"
gh issue close <number>
```

Tests fail? Docs broken? Fix them. All of them. Then push.

---

## Related

- [Unit Testing](./unit-testing.md) - Database isolation, coverage thresholds, parallelism
- [Create Tickets from ERD](./create-tickets-from-erd.md) - How tickets are created from ERDs
- [Engineering Requirements Document](./erd.md) - Technical specs that define ticket requirements
- [Product Requirements Document](../product/prd.md) - Product requirements that inform ERDs
- [Frontend Architecture](./frontend.md) - Component and hook organization
- [Test-Driven Development](./tdd.md) - TDD workflow details
