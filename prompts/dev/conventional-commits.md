# Conventional Commits

A specification for structured, meaningful commit messages.

## Format

```
<type>(<scope>): <description>

<body>

<footer>
```

## Types

| Type | Purpose |
|------|---------|
| `feat` | New feature (MINOR version bump) |
| `fix` | Bug fix (PATCH version bump) |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change that neither fixes nor adds |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system or dependencies |
| `ci` | CI configuration |
| `chore` | Maintenance tasks |

## Breaking Changes

Signal breaking changes with `!` or a footer:

```
feat(api)!: remove deprecated endpoints

BREAKING CHANGE: /v1/users endpoint removed
```

---

## What Makes an Excellent Commit Message

### The Subject Line

- **50 characters max** - forces clarity
- **Imperative mood** - "Add feature" not "Added feature"
- **No period** at the end
- **Capitalize** the first word

### The Body

Answer two questions:
1. **What** changed?
2. **Why** was this change made?

The diff shows *how* - your message explains the reasoning.

### Atomic Commits

One logical change per commit. If you need "and" in your subject, split it.

---

## File Reference Style

**Always reference specific files and describe the modification type.**

### Format

```
<type>(<scope>): <description>

- <file_path>: <what changed>
- <file_path>: <what changed>
```

### Modification Verbs

Use precise verbs to describe changes:

| Verb | Meaning |
|------|---------|
| `add` | New file or new code block |
| `remove` | Deleted file or code block |
| `update` | Modified existing behavior |
| `rename` | Changed file/function/variable name |
| `move` | Relocated code to different file/location |
| `extract` | Pulled code into new function/module |
| `inline` | Collapsed abstraction back into caller |
| `fix` | Corrected broken behavior |
| `refactor` | Restructured without behavior change |

### Examples

```
feat(auth): add JWT token refresh endpoint

- src/auth/refresh.ts: add new endpoint handler
- src/auth/middleware.ts: update to check token expiry
- src/types/auth.ts: add RefreshToken interface
```

```
fix(api): prevent null pointer in user lookup

- src/services/user.ts: add null check before accessing profile
- tests/user.test.ts: add test case for missing user
```

```
refactor(db): extract connection pooling logic

- src/db/pool.ts: add new module for connection management
- src/db/client.ts: remove inline pooling, import from pool
- src/db/index.ts: update exports
```

```
docs(readme): update installation instructions

- README.md: update Node version requirement to 20.x
- README.md: add Docker setup section
```

### Multi-file Refactors

For larger changes, group by intent:

```
refactor(components): convert class components to hooks

Button:
- src/components/Button.tsx: convert to functional component
- src/components/Button.test.ts: update test setup

Modal:
- src/components/Modal.tsx: convert to functional component
- src/components/Modal.tsx: extract useModalState hook
- src/hooks/use-modal-state.ts: add new hook
- src/hooks/use-modal-state.test.ts: add hook tests
```

### Prisma Schema Changes

```
feat(db): add posts table with user relation

- prisma/schema.prisma: add Post model with User relation
- src/lib/posts.ts: add post CRUD functions
- src/lib/posts.test.ts: add tests for post functions
- src/hooks/use-posts.ts: add data fetching hook
```

---

## Closing Tickets

**If a commit completes a ticket, include `Closes #<number>` in the footer.**

This automatically closes the GitHub issue when the commit is merged to the default branch.

```
feat(auth): add password reset flow

- src/auth/reset.ts: add reset token generation
- src/auth/reset.test.ts: add tests for reset flow
- src/components/ResetForm.tsx: add password reset form

Closes #42

Co-Authored-By: Claude <noreply@anthropic.com>
```

For commits that relate to but don't complete a ticket, use `Refs #<number>` instead:

```
refactor(auth): extract token utilities

- src/auth/tokens.ts: extract from reset.ts
- src/auth/tokens.test.ts: add dedicated tests

Refs #42
```

---

## Why This Matters

- **Code review** - reviewers see intent before reading diff
- **Git bisect** - find exactly which change introduced a bug
- **Changelog generation** - automated release notes
- **Future you** - understand decisions months later
- **Ticket tracking** - commits link to issues automatically

---

## Quick Reference

```
feat(scope): add thing          # new feature
fix(scope): correct thing       # bug fix
docs(scope): explain thing      # documentation
refactor(scope): restructure    # no behavior change
perf(scope): speed up thing     # performance
test(scope): verify thing       # tests
chore(scope): maintain thing    # maintenance
```

Always list files touched and how.

---

## Related

- [Implement Ticket](./implement-ticket.md) - Full workflow that uses conventional commits
- [Create Tickets from ERD](./create-tickets-from-erd.md) - Ticket titles follow conventional commit types
- [Pre-Push Cleanup](./cleanup.md) - Self-review before committing
- [Frontend Architecture](./frontend.md) - Component and hook organization patterns
