# Pre-Push Cleanup

You're done. Tests pass. Docs compile. Before you push, review your own work.

---

## The Process

### 1. Format and Verify

Run your formatter and compile docs. Don't make reviewers comment on whitespace or broken documentation.

```bash
bun run check      # format + lint with Biome
bun run docs       # TypeDoc compiles
```

### 2. Stage Everything

```bash
git add -A
```

### 3. Review Your Own Diff

```bash
git diff --staged
```

Read it like a reviewer would. Line by line.

---

## What to Look For

### Repeated Code

You wrote the same logic twice? Three times? Extract it.

```typescript
// Before: copy-pasted validation
if (user.email && user.email.includes('@')) { ... }
// ... 40 lines later ...
if (admin.email && admin.email.includes('@')) { ... }

// After: one function
function isValidEmail(email: string): boolean {
  return Boolean(email && email.includes('@'));
}
```

### Debug Leftovers

```typescript
console.log('here');           // delete
console.log('user:', user);    // delete
debugger;                      // delete
// TODO: remove this           // remove this
```

### Commented-Out Code

```typescript
// const oldImplementation = () => {
//   ...50 lines...
// };
```

Delete it. Git remembers.

### Hardcoded Values That Should Be Constants

```typescript
// Before
if (retries > 3) { ... }
setTimeout(fn, 5000);

// After
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;
```

### Inconsistent Naming

You called it `userData` in one place and `userInfo` in another. Pick one.

### Missing Error Handling

You added the happy path. What happens when:
- The network fails?
- The input is null?
- The Prisma query returns nothing?

### Accidental Complexity

That clever one-liner? Replace it with three readable lines.

```typescript
// Before: clever
const result = data?.items?.filter(Boolean).reduce((a, b) => ({...a, [b.id]: b}), {}) ?? {};

// After: readable
const result: Record<string, Item> = {};
for (const item of data?.items ?? []) {
  if (item) {
    result[item.id] = item;
  }
}
```

### Scope Creep

You were fixing a bug in the login flow. Why is there a refactored date utility in this diff?

Keep commits focused. Split unrelated changes.

### Type Shortcuts

```typescript
// Before
const data: any = fetchData();
const config = response as unknown as Config;

// After: actual types
const data: UserResponse = fetchData();
const config: Config = parseConfig(response);
```

### Dead Code

That function you wrote but never called? That variable you assigned but never read? Delete it.

### Tests in Wrong Location

Unit tests must be next to their source files:

```
src/
├── lib/
│   ├── users.ts
│   └── users.test.ts    # ✓ Correct
```

NOT in a separate `tests/` directory:

```
tests/
├── lib/
│   └── users.test.ts    # ✗ Wrong
```

### E2E Tests with Wrong Extension

E2E tests must use `*.e2e.ts` in the `e2e/` directory:

```
e2e/
├── auth.e2e.ts         # ✓ Correct
```

NOT `*.e2e.test.ts` (bun will pick these up):

```
e2e/
├── auth.e2e.test.ts     # ✗ Wrong - bun will try to run this
```

### Missing or Broken Documentation

New public functions need TypeDoc comments. If `bun run docs` fails, fix it before pushing.

```typescript
// Before: no docs
export function processOrder(order: Order): Receipt {

// After: documented
/**
 * Processes an order and generates a receipt.
 * @param order - The order to process
 * @returns The generated receipt
 * @throws {InvalidOrderError} If the order is malformed
 */
export function processOrder(order: Order): Receipt {
```

### External Service References

Did you accidentally add an external service dependency?

```typescript
// Wrong - external service
import { createClient } from '@supabase/supabase-js';

// Wrong - external auth
import { auth0 } from 'auth0';

// Right - local Prisma
import { prisma } from '@/lib/prisma';
```

If you need an external service, it must be explicitly approved in the PRD.

### Hooks Not Extracted

Business logic should be in hooks, not components:

```typescript
// Before: logic in component
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
  }, [userId]);
  // ...
}

// After: hook extracted (and testable)
function UserProfile({ userId }) {
  const { user, isLoading } = useUser(userId);
  // ...
}
```

---

## The Checklist

Before pushing:

- [ ] Code is formatted (`bun run check`)
- [ ] Docs compile (`bun run docs`)
- [ ] Unit tests pass (`bun test`)
- [ ] E2E tests pass (`bun run test:e2e`)
- [ ] Build succeeds (`bun run build`)
- [ ] No console.log / debugger / print statements
- [ ] No commented-out code
- [ ] No copy-pasted blocks (DRY)
- [ ] Naming is consistent
- [ ] No `any` types or unsafe casts
- [ ] No hardcoded magic numbers
- [ ] Error cases are handled
- [ ] No unrelated changes in the diff
- [ ] Every function/variable is actually used
- [ ] Public APIs have TypeDoc comments
- [ ] Unit tests are next to source files (`*.test.ts`)
- [ ] E2E tests use `*.e2e.ts` in `e2e/`
- [ ] No external service dependencies added
- [ ] Hooks extracted for testable logic

---

## Why Self-Review

Every issue you catch is one less:
- Code review comment to address
- Back-and-forth with reviewers
- Context switch when you revisit later
- Bug in production

Your reviewer's time is valuable. Don't waste it on things you could have caught yourself.

---

## Quick Reference

```bash
# Format and verify docs
bun run check
bun run docs

# Run tests
bun test
bun run test:e2e

# Build
bun run build

# Stage
git add -A

# Review
git diff --staged

# Commit when clean
git commit -m "feat(auth): add password reset flow"
```

Read your diff. Fix what you find. Compile docs. Then push.

---

## Related

- [Implement Ticket](./implement-ticket.md) - Full ticket workflow that ends with cleanup
- [Conventional Commits](./conventional-commits.md) - Commit message format after cleanup
- [Test-Driven Development](./tdd.md) - TDD workflow before cleanup
- [Frontend Architecture](./frontend.md) - Hook extraction patterns
