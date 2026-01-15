# Claude Development Guide

Guidelines for Claude Code when working on this project.

## Quick Commands

```bash
bun run dev        # Start dev server
bun test           # Run unit tests (95% coverage required)
bun run test:e2e   # Run Playwright E2E tests
bun run check      # Lint and format with Biome
bun run docs       # Generate TypeDoc
bun run build      # Production build
```

**Before any commit, all of these must pass:**
```bash
bun run check && bun run docs && bun test && bun run test:e2e && bun run build
```

## Project Architecture

- **Next.js 16** with App Router
- **SQLite + Prisma** - Multi-file schema in `prisma/`
- **Server Actions** in `src/app/actions/` - No REST API routes
- **Session-based auth** - Custom implementation, no external providers
- **Multi-tenant** - Application-level tenant isolation via middleware

## File Organization

```
src/app/(app)/       # Protected routes (todos, settings)
src/app/actions/     # Server actions
src/components/ui/   # Radix UI components
src/lib/             # Utilities and helpers
prisma/              # Database schema (split by domain)
e2e/                 # Playwright E2E tests (.e2e.ts)
prd/                 # Product requirements documents
```

## Testing Rules

1. **Unit tests** use `*.test.ts` and live **next to source files** (not in `tests/`)
2. **E2E tests** use `*.e2e.ts` in `e2e/` directory
3. **95% coverage minimum** - Build fails if not met
4. **TDD workflow**: Write failing test → stub → verify fail → implement → pass

## Code Style

- Use Biome for formatting and linting (not ESLint)
- Single quotes, semicolons
- No external services (Auth0, Supabase, etc.) - roll our own
- Server actions instead of API routes

## Ticket Workflow

1. Move ticket to "in progress" via `gh issue edit <num> --add-label "in progress"`
2. Follow TDD - write test first
3. Run full check suite before commit
4. Use conventional commits with `Closes #<ticket-number>`
5. Update ticket via `gh` CLI

## Commit Format

```
<type>(<scope>): <description>

- bullet points of changes

Closes #<ticket-number>

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `test`, `docs`, `refactor`, `chore`

## Constraints

- No external services (Auth0, Stripe, etc.) unless explicitly required
- GitHub for everything - issues, projects, PRs via `gh` CLI
- SQLite only - no external databases
- Tests must pass in parallel without flaking
