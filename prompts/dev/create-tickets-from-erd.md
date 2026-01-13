# Creating Tickets from an ERD

Breaking down an [Engineering Requirements Document](./erd.md) into actionable tickets, ordered for dependency-aware burndown.

---

## Philosophy

> "I never start with building the 'best' or 'most complete' implementation of a story. I start with the smallest possible thing that does essential work and then get feedback."
> — Allen Holub

The ERD describes the epic. Tickets are the atomic units of work that compose it. The goal is to create a backlog you can burn down in precise order, where each ticket builds on the last.

### Why Order Matters

> "The ROI of an individual item depends on its position in the backlog."
> — Scrum.org

Dependencies determine order, not arbitrary priority. A high-priority ticket blocked by an incomplete dependency is worthless. Order the backlog so you never start something you can't finish.

---

## GitHub CLI Required

**All tickets must be created and updated using the `gh` CLI tool.**

Do NOT:
- Create issues through the GitHub web UI
- Use Jira, Linear, Notion, or other tools
- Manually edit issue status in the browser

**Why:** The CLI is scriptable, consistent, and keeps everything in version control workflows. It also ensures you can create tickets programmatically from ERDs.

### Setup

```bash
# Check auth status
gh auth status

# Add project scope if needed
gh auth refresh -s project

# Verify you can access issues
gh issue list
```

---

## Prerequisites

### Identify or Create the Project

Check if a GitHub Project exists for this repo:

```bash
# List projects for the repo owner
gh project list --owner <owner>
```

If no project exists, create one:

```bash
# Create a new project
gh project create --owner <owner> --title "<Project Name>"
```

After creation, configure the board view in the GitHub UI:
1. Open the project
2. Click the view dropdown → New view → Board
3. Set columns to use the Status field (Backlog, In Progress, Done)

---

## The Process

### Step 1: Read the ERD

Open the ERD (e.g., `./erd/0001-user-authentication.md`) and identify:

- **Components** — Each distinct system component
- **Requirements** — Each REQ-XXX item
- **API endpoints** — Each route or server action
- **Data models** — Each Prisma model or migration
- **Dependencies** — What depends on what

### Step 2: Build the Dependency Graph

Before creating tickets, map what depends on what.

```
Prisma Schema
    ↓
Types/Interfaces
    ↓
Server Actions / API Routes
    ↓
Hooks (data fetching)
    ↓
Components
    ↓
E2E Tests
```

**Rule:** A ticket can only be worked on when all its dependencies are complete.

### Step 3: Slice Vertically

> "A vertical slice is a work item that delivers a valuable change in system behavior such that you'll probably have to touch multiple architectural layers."
> — Humanizing Work

**Wrong (horizontal slices):**
- Ticket 1: Create Prisma schema
- Ticket 2: Create API routes
- Ticket 3: Create UI components

**Right (vertical slices):**
- Ticket 1: User can create account (schema + action + minimal UI)
- Ticket 2: User can view profile (query + hook + component)
- Ticket 3: User can edit profile (action + form component)

Each ticket delivers working, testable functionality.

### Step 4: Apply INVEST Criteria

Each ticket should be:

| Criterion | Meaning |
|-----------|---------|
| **I**ndependent | Can be completed without waiting (after deps are done) |
| **N**egotiable | Details can be discussed during implementation |
| **V**aluable | Delivers user or system value |
| **E**stimable | Small enough to estimate confidently |
| **S**mall | Completable in 1-3 days |
| **T**estable | Has clear acceptance criteria |

> "Engineering Tasks have to be estimated as no more than 5, and preferably less than 3 ideal engineering days."
> — Kent Beck

### Step 5: Order by Dependencies

Use topological sort logic:

1. **Foundation first** — Prisma schema, types, shared utilities
2. **Core functionality** — Primary user flows
3. **Secondary features** — Enhancements, edge cases
4. **Polish** — Error handling, performance, observability

Within each tier, order by:
- Technical dependencies (what must exist first)
- Risk (high-risk items early for faster feedback)
- Value (higher value when dependencies are equal)

### Step 6: Create Tickets with gh CLI

**All tickets must be created using `gh issue create`.**

Create each ticket in dependency order:

```bash
# Create an issue and add to project
gh issue create \
  --title "feat(users): add user table schema" \
  --body "$(cat <<'EOF'
## Context
ERD: ERD-0001
Depends on: None (foundation)

## Requirements
- REQ-001: Users table with id, email, name, created_at
- REQ-002: Unique constraint on email

## Acceptance Criteria
- [ ] Prisma schema defines User model
- [ ] Migration runs successfully (`bunx prisma db push`)
- [ ] Schema matches ERD specification

## Technical Notes
See ERD-0001 Data Model section.
Uses SQLite with Prisma.
EOF
)" \
  --project "<Project Name>"
```

**Ticket title format:** `<type>(<scope>): <description>`

Types match conventional commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

### Step 7: Link Related Tickets

After creating tickets, link dependencies:

```bash
# Add a comment linking to blocking ticket
gh issue comment <number> --body "Blocked by #<blocking-number>"

# Or edit the body to include links
gh issue edit <number> --body "$(gh issue view <number> --json body -q .body)

Blocked by: #<blocking-number>"
```

### Step 8: Set Ticket Order in Project

After creating all tickets, ensure they're ordered correctly in the Backlog column:

```bash
# List project items to verify order
gh project item-list <PROJECT_NUMBER> --owner <owner>
```

Reorder in the GitHub UI by dragging tickets in the Backlog column. The top ticket is next to be worked.

---

## Ticket Template

```markdown
## Context
ERD: [Link to ERD, e.g., ERD-0001]
PRD: [Link to PRD if applicable]
Depends on: [List of blocking ticket numbers, or "None"]
Blocks: [List of tickets this unblocks, or "None"]

## Requirements
- REQ-XXX: [Requirement from ERD]
- REQ-YYY: [Another requirement]

## Acceptance Criteria
- [ ] [Specific, testable criterion]
- [ ] [Another criterion]
- [ ] Unit tests pass (`bun test`)
- [ ] E2E tests pass (`bun run test:e2e`)
- [ ] Build passes (`bun run build`)

## Technical Notes
[Any implementation guidance, links to relevant ERD sections]
Stack: Next.js, Prisma, SQLite, shadcn/ui

## Out of Scope
[What this ticket explicitly does not include]
```

---

## Updating Tickets

**All ticket updates must use `gh` CLI.**

```bash
# View a ticket
gh issue view <number>

# Add a label
gh issue edit <number> --add-label "in progress"

# Remove a label
gh issue edit <number> --remove-label "in progress"

# Add a comment
gh issue comment <number> --body "Started work on this"

# Close a ticket
gh issue close <number>

# Reopen a ticket
gh issue reopen <number>

# Assign to yourself
gh issue edit <number> --add-assignee @me
```

### Status Labels

Use consistent labels across projects:

| Label | Meaning |
|-------|---------|
| `backlog` | Not yet started |
| `in progress` | Currently being worked on |
| `blocked` | Waiting on dependency |
| `ready for review` | PR submitted |
| `done` | Completed and merged |

---

## Dependency Patterns

### Common Dependency Chains

```
1. Prisma schema migrations
   ↓
2. Type definitions / interfaces
   ↓
3. Server actions / API routes
   ↓
4. Custom hooks (useUser, useOrders)
   ↓
5. UI components
   ↓
6. E2E tests
```

### Breaking Circular Dependencies

If A depends on B and B depends on A:
1. Extract the shared concern into ticket C
2. A and B both depend on C
3. A and B can then be parallelized

### Handling Unknowns

> "If your team estimates a story at more than about 3 weeks, split it—on the grounds that we don't understand it."
> — Ron Jeffries

If a ticket is too large or unclear:
1. Create a spike/research ticket first
2. Spike output informs how to split the work
3. Create the real tickets after the spike

---

## The Burndown Rule

**Work the backlog top to bottom. No skipping.**

When you pick up the next ticket:
1. All dependencies should already be complete
2. If they're not, something is wrong with the order
3. Fix the order, don't skip ahead

> "Proper ordering takes deep knowledge of the business, market, and engineering dependencies between items."
> — Scrum.org

---

## Checklist

Before starting burndown:

- [ ] GitHub Project exists (kanban board)
- [ ] `gh` CLI authenticated with project scope
- [ ] All tickets created from ERD requirements using `gh issue create`
- [ ] Each ticket has clear acceptance criteria
- [ ] Each ticket is INVEST-compliant (especially Small and Testable)
- [ ] Dependencies documented in each ticket
- [ ] Tickets ordered by dependency graph
- [ ] No ticket depends on one below it in the backlog
- [ ] First ticket has no dependencies

---

## Quick Reference

```bash
# Auth with project scope
gh auth refresh -s project

# List existing projects
gh project list --owner <owner>

# Create new project
gh project create --owner <owner> --title "Project Name"

# Create issue and add to project
gh issue create \
  --title "feat(scope): description" \
  --body "Issue body" \
  --project "Project Name"

# View issue
gh issue view <number>

# Edit issue
gh issue edit <number> --add-label "in progress"

# Comment on issue
gh issue comment <number> --body "Update message"

# Close issue
gh issue close <number>

# List project items
gh project item-list <number> --owner <owner>

# Add existing issue to project
gh project item-add <number> --owner <owner> --url <issue-url>
```

---

## Related

- [Engineering Requirements Document](./erd.md) - How to write ERDs
- [Product Requirements Document](../product/prd.md) - Product requirements that inform ERDs
- [Implement Ticket](./implement-ticket.md) - Process for completing tickets
- [Conventional Commits](./conventional-commits.md) - Commit message format for tickets

---

## Sources

This guide synthesizes best practices from:

- [Allen Holub](https://holub.com/classes/stories2code/) — Vertical slicing, smallest valuable increment
- [Kent Beck](https://tidyfirst.substack.com/p/scaling-extreme-programming-dependencies) — XP task breakdown, dependency management
- [Scrum.org](https://www.scrum.org/resources/ordered-not-prioritized) — Ordering vs prioritization, dependency awareness
- [Atlassian](https://www.atlassian.com/agile/project-management/epics) — Epic breakdown, user story best practices
- [Humanizing Work](https://www.humanizingwork.com/the-humanizing-work-guide-to-splitting-user-stories/) — Story splitting techniques
- [GitHub CLI](https://cli.github.com/manual/gh_project) — Project and issue management commands
- [GitHub Blog](https://github.blog/developer-skills/github/github-cli-project-command-is-now-generally-available/) — gh project command documentation
