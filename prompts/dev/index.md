# Dev Documentation

Developer guides and conventions for this project.

## The Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Database | Prisma + SQLite (multi-file schema) |
| Runtime | Bun |
| Hosting | Sprite |

## Contents

- [Project Setup](./setup.md) - Bootstrap projects with the full stack
- [Unit Testing](./unit-testing.md) - Database isolation, coverage thresholds, parallelism
- [Frontend Architecture](./frontend.md) - Component organization, hooks, shadcn/ui patterns
- [Engineering Requirements Document](./erd.md) - Technical specs and design docs
- [Create Tickets from ERD](./create-tickets-from-erd.md) - Break ERD into ordered backlog (via `gh` CLI)
- [Implement Ticket](./implement-ticket.md) - End-to-end process for completing a ticket
- [Conventional Commits](./conventional-commits.md) - Commit message format and best practices
- [Test-Driven Development](./tdd.md) - TDD with bun test, test-near-code pattern
- [Pre-Push Cleanup](./cleanup.md) - Self-review before pushing

## Key Constraints

- **No external services** unless explicitly requested
- **SQLite only** — no Postgres, MySQL, or cloud databases
- **GitHub CLI (`gh`)** for all ticket operations
- **Unit tests next to source** — no `tests/` directory
- **E2E tests in `e2e/`** — use `*.e2e.ts`, not `*.e2e.test.ts`
- **95% coverage minimum** — enforced by bunfig.toml threshold
- **One database per test** — enables parallel execution

## Related

- [Product Requirements Document](../product/prd.md) - Product counterpart to the ERD
