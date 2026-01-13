# Engineering Requirements Document (ERD)

The technical counterpart to the PRD. How we'll build what product defined.

---

## Philosophy

> "As software engineers, the job is not to produce code per se, but rather to solve problems."
> — Design Docs at Google

The ERD translates product requirements into technical decisions. It documents the *how* — architecture, trade-offs, risks, and implementation strategy — before code is written.

### Why Write ERDs

- **Alignment** — Engineering, product, and stakeholders agree on approach before building
- **Trade-off documentation** — Record why decisions were made, not just what was decided
- **Risk identification** — Surface problems early when they're cheap to fix
- **Onboarding** — New engineers understand the system without archaeology
- **Review** — Senior engineers can catch issues before they're in production

> "Unstructured text, like in the form of a design doc, may be the better tool for solving problems early in a project lifecycle, as it may be more concise and easier to comprehend."
> — Google Engineering

---

## Constraints

### The Stack

All projects use this stack unless explicitly specified otherwise:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Database | Prisma + SQLite |
| Runtime | Bun |
| Hosting | Sprite |

### No External Services

**You are forbidden from using external services unless specifically asked.**

Do NOT specify:
- Auth0, Clerk, or external auth providers → Roll your own with sessions
- Supabase, PlanetScale, or external databases → Use SQLite
- Vercel Blob, S3, or external storage → Use local filesystem
- SendGrid, Resend, or external email → Log to console in dev
- Stripe → Only if payments are explicitly required

**Why:** External services require configuration, accounts, API keys, and network access. Projects must run immediately on checkout without issue.

### SQLite + Sprite

The database is SQLite. This is intentional:
- No database server to configure
- No connection strings to manage
- Database is a file that Sprite persists
- Clone, install, run — that's it

When writing ERDs, design for SQLite:
- Single-file database in `prisma/dev.db`
- No stored procedures or database-specific features
- Prisma handles all data access

---

## File Organization

ERDs are stored in the `./erd/` directory with sequential 4-digit identifiers followed by a kebab-case description:

```
erd/
├── 0001-user-authentication.md
├── 0002-payment-processing.md
├── 0003-notification-system.md
└── ...
```

**Naming rules:**
- 4-digit zero-padded prefix (`0001`, not `1`)
- Followed by hyphen and kebab-case description
- Sequential numbers, never reused
- Reference in commits and PRs as `ERD-0001`

Each ERD should link to its corresponding PRD when applicable. See the [PRD guide](../product/prd.md) for how to write PRDs.

---

## Core Principles

### 1. Requirements Must Be Testable

> "The most important characteristic of an engineering requirement is that it must be testable. If a requirement cannot objectively be determined to be satisfied or not, it is not properly written."

**Wrong:** "The system should be fast"
**Right:** "API responses must return within 200ms at p95"

### 2. Use Precise Language

Use "shall" for mandatory requirements, "should" for recommendations, "may" for optional.

| Word | Meaning |
|------|---------|
| shall | Mandatory, must be implemented |
| should | Recommended, implement unless good reason not to |
| may | Optional, implement if beneficial |

### 3. Write Iteratively

> "The lead engineer writes the first draft, with strong input from product and security. Developers add details for their parts."

Don't write in isolation. Share early, get feedback, refine.

### 4. Document Trade-offs

Every significant decision has alternatives. Document:
- What options were considered
- Why you chose this one
- What you're giving up

### 5. Living Document

> "The TDD is a living document. Update it as decisions are made and designs evolve to maintain accuracy."

The ERD evolves with the project. Update it when reality diverges from plan.

---

## The Template

### Metadata

```
ERD: [4-digit ID]
Title: [Feature Name]
Author: [Engineer Name]
Status: [Draft | In Review | Approved | In Progress | Complete]
PRD: [Link to corresponding PRD, if any]
Last Updated: [Date]
Reviewers: [List of reviewers]
```

### Overview

**One paragraph** summarizing what this document covers and why.

### Background

What context does the reader need? Link to:
- Related PRD
- Existing systems this touches
- Previous decisions that constrain this one

### Goals and Non-Goals

**Goals:** What technical outcomes are we trying to achieve?

**Non-Goals:** What are we explicitly not solving? What's out of scope?

### Constraints Checklist

Before proceeding, verify:

- [ ] Uses SQLite (not Postgres, MySQL, etc.)
- [ ] No external authentication services
- [ ] No external database services
- [ ] No external storage services
- [ ] No external email services
- [ ] Runs on checkout without configuration

If any external service is required, it must be explicitly approved in the PRD.

### Architecture

**System Design**

High-level architecture. Diagrams are encouraged.

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │────▶│ Next.js │────▶│ SQLite  │
└─────────┘     └─────────┘     └─────────┘
                     │
              ┌──────┴──────┐
              │   Prisma    │
              └─────────────┘
```

**Components**

List each component and its responsibility.

**Data Flow**

How does data move through the system?

### Technical Requirements

Use requirement IDs for traceability.

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | API shall respond within 200ms at p95 | Must |
| REQ-002 | System shall handle 100 concurrent users | Must |
| REQ-003 | Data should be validated before storage | Should |

### API Design

If introducing or modifying APIs, use Next.js patterns:

```typescript
// app/api/users/route.ts
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();

  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
    },
  });

  return NextResponse.json(user, { status: 201 });
}
```

Or Server Actions:

```typescript
// app/actions/users.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createUser(data: CreateUserInput) {
  const user = await prisma.user.create({ data });
  revalidatePath('/users');
  return user;
}
```

### Data Model

We use **multi-file Prisma schemas** — one file per domain. See [Project Setup](./setup.md) for full details.

```
prisma/
├── schema.prisma       # Generator + datasource only
├── user.prisma         # User model
├── post.prisma         # Post model
└── migrations/
```

```prisma
// prisma/user.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```prisma
// prisma/post.prisma
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}
```

**Requires** `prisma.schema` config in `package.json`:

```json
{
  "prisma": {
    "schema": "./prisma"
  }
}
```

### Alternatives Considered

What other approaches did you evaluate?

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| PostgreSQL | Full-featured | Requires server | External dependency |
| Auth0 | Easy to integrate | Requires account | External service |
| In-memory store | Fast | Not persistent | Data loss on restart |

### Security Considerations

- Authentication: Session-based (no external providers)
- Authorization: Role-based, stored in SQLite
- Input validation: Zod schemas
- Data sensitivity: PII handling

### Testing Strategy

- Unit tests (`*.test.ts` next to source)
- E2E tests (`e2e/*.e2e.ts`)
- Mock database for unit tests
- Real SQLite for integration tests

### Deployment

Deployed to Sprite:
- SQLite file persisted by Sprite filesystem
- No external services to configure
- Environment variables have sensible defaults

### Open Questions

**This section should be empty in a finished ERD.**

If you have open questions, answer them yourself. Make a decision. The ERD author is responsible for making technical decisions — that's the job. Don't punt decisions to reviewers.

Use this section only as a *temporary* scratchpad while drafting. Before marking the ERD as "In Review," resolve every question and delete this section or leave it empty.

### Dependencies

- No external service dependencies (by design)
- Other internal modules this depends on
- Timeline blockers

---

## Anti-Patterns

### Writing After Implementation

The ERD documents decisions *before* they're made. Writing it after is just documentation.

### No Trade-off Analysis

If you only present one option, you haven't done design work. Show alternatives.

### Vague Requirements

"Fast," "scalable," "secure" mean nothing without numbers.

### External Service Creep

Adding "just one" external service breaks the zero-config promise. Push back.

### Hiding Complexity

Don't gloss over the hard parts. That's where bugs live.

### Stale Documents

An ERD that doesn't match the implementation is worse than no ERD.

---

## Checklist

Before requesting review:

- [ ] Links to corresponding PRD (if applicable)
- [ ] Goals and non-goals are explicit
- [ ] Constraints checklist completed (no external services)
- [ ] Architecture diagram exists
- [ ] Requirements are testable and numbered
- [ ] Alternatives were considered and documented
- [ ] Security implications addressed
- [ ] Testing strategy defined
- [ ] SQLite schema defined in Prisma format
- [ ] Open questions are surfaced

---

## Related

- [Product Requirements Document](../product/prd.md) - Product counterpart to the ERD
- [Create Tickets from ERD](./create-tickets-from-erd.md) - Break down ERDs into actionable tickets
- [Implement Ticket](./implement-ticket.md) - Process for completing tickets
- [Project Setup](./setup.md) - Stack configuration details

---

## Sources

This guide synthesizes best practices from:

- [Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/) — Google's design doc culture and structure
- [Stack Overflow](https://stackoverflow.blog/2020/04/06/a-practical-guide-to-writing-technical-specs/) — Practical guide to writing technical specs
- [Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/software-engineering-rfc-and-design) — RFC and design doc examples from top companies
- [Stripe Engineering](https://newsletter.pragmaticengineer.com/p/stripe-part-2) — Writing culture and artifact creation
- [Uber Engineering](https://eng.uber.com/learning-on-the-go-engineering-efficiency-with-concise-documentation/) — Concise documentation practices
- [Fictiv](https://www.fictiv.com/articles/how-to-write-an-engineering-requirements-document) — Engineering requirements document structure
- [Phil Calçado](https://philcalcado.com/2018/11/19/a_structured_rfc_process.html) — Structured RFC process
