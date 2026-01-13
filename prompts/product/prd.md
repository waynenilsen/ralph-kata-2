# Product Requirements Document (PRD)

A guide to writing PRDs that actually get used.

---

## Philosophy

> "The purpose of the product requirements document is to clearly and unambiguously articulate the product's purpose, features, functionality, and behavior."
> — Marty Cagan, Silicon Valley Product Group

A PRD is not a novel. It's not a spec for engineers to "implement." It's a thinking tool that forces clarity before building.

### The Modern PRD

The exhaustive 50-page PRDs of the past are dead. Modern PRDs are:

- **Concise** — If it doesn't fit on a page, you don't understand the problem yet
- **Living** — Updated throughout the project, not frozen at kickoff
- **Problem-first** — Separate problem understanding from solution design
- **Testable** — Include prototypes, not just prose

> "If you think you can get what you need by having product managers document PRDs instead of product discovery, then you may as well just give up on innovation."
> — Marty Cagan

---

## Core Principles

### 1. Problem Before Solution

Every high-performing PRD template separates problem from solution. Intercom takes this furthest: "Do not add the solution here."

**Why:** Jumping to solutions is the most common failure mode. You end up building the wrong thing really well.

> "Nailing the problem statement is the single most important step in solving any problem. It's deceptively easy to get wrong."
> — Lenny Rachitsky

### 2. Explicit Non-Goals

Define what you're *not* building as clearly as what you are. This prevents scope creep before it starts.

Kevin Yien (Square) and Basecamp's Shape Up both emphasize boundaries as much as requirements.

### 3. Write Iteratively

> "Good PMs write detailed PRDs. Great PMs iteratively write their PRDs so engineering and design tasks are rarely blocked on them."
> — Shreyas Doshi

Don't disappear for two months and emerge with a "perfect spec." Write, share, refine. Repeat.

### 4. Living Document

> "A PRD can (and should) be updated throughout the lifecycle of the project."
> — Shreyas Doshi

As engineers dig into implementation, they'll surface questions. Add clarifications. Update scope. The PRD evolves with the project.

### 5. One Page Rule

> "An Intermission must always fit on a printed A4 page. If it does not, you haven't a clear enough view of the problem yet."
> — Intercom

Constraints force clarity. If you can't explain it simply, you don't understand it well enough.

### 6. No External Services (Default)

**Projects must run immediately on checkout without configuration.**

This means:
- No Auth0, Clerk, or external auth providers
- No Supabase, PlanetScale, or external databases
- No S3, Vercel Blob, or external storage
- No Stripe (unless payments are explicitly required)

If your PRD requires an external service, you must:
1. Explicitly state it as a requirement
2. Justify why a local alternative won't work
3. Accept the configuration burden this creates

Default assumption: SQLite database, local filesystem, session-based auth.

---

## File Organization

PRDs are stored in the `./prd/` directory with sequential 4-digit identifiers followed by a kebab-case description:

```
prd/
├── 0001-user-authentication.md
├── 0002-payment-processing.md
├── 0003-notification-system.md
└── ...
```

**Naming rules:**
- 4-digit zero-padded prefix (`0001`, not `1`)
- Followed by hyphen and kebab-case description
- Sequential numbers, never reused
- Reference in commits, PRs, and ERDs as `PRD-0001`

Each PRD may have a corresponding ERD (Engineering Requirements Document) in `./erd/` with the same number. See the [ERD guide](../dev/erd.md) for how to write ERDs.

---

## The Template

### Metadata

```
PRD: [4-digit ID]
Title: [Feature Name]
Author: [PM Name]
Status: [Draft | In Review | Approved | In Progress | Shipped]
ERD: [Link to corresponding ERD, if any]
Last Updated: [Date]
```

### Problem

**What problem are we solving?**

Describe the customer pain. Link to customer conversations, support tickets, or research. Be specific.

**Who has this problem?**

Define the user segment. Not "everyone" — the specific persona experiencing this pain.

**Why solve it now?**

What's the opportunity cost of waiting? What's changed that makes this urgent?

### Non-Goals

What are we explicitly *not* doing? What's out of scope?

This section is as important as the goals. It prevents scope creep and sets expectations.

**Default non-goals** (unless explicitly required):
- External authentication services
- External database services
- External storage services
- External email services

### Success Criteria

How will we know this worked?

- **Quantitative:** Metrics that will move (e.g., "Reduce support tickets about X by 30%")
- **Qualitative:** User feedback we expect to hear

Be specific. "Users are happier" is not a success criterion.

### Solution

**High-level approach**

How will we solve the problem? Keep it brief — the prototype shows the details.

**User Stories / Job Stories**

```
When [situation], I want to [action], so I can [outcome].
```

**What's in scope**

List the specific capabilities being built.

**What's out of scope**

Reiterate boundaries from Non-Goals as they apply to the solution.

### Prototype

Link to the high-fidelity prototype. This is the spec.

> "The majority of the product spec should be the high-fidelity prototype. Unlike a paper document, a prototype can be tested."
> — Marty Cagan

### Open Questions

**This section should be empty in a finished PRD.**

If you have open questions, answer them yourself. Make a decision. The PRD author is responsible for making product decisions — that's the job. Don't punt decisions to reviewers or stakeholders.

Use this section only as a *temporary* scratchpad while drafting. Before marking the PRD as "In Review," resolve every question and delete this section or leave it empty.

### Dependencies

What do we need from other teams? What external factors affect delivery?

---

## Alternative: Amazon PR/FAQ

For major new products, consider Amazon's Working Backwards approach.

Write a press release announcing the product as if it's already launched:

1. **Headline** — One sentence describing the benefit
2. **Subheadline** — Who it's for and why they care
3. **Problem** — The customer pain
4. **Solution** — How the product solves it
5. **Quote from you** — Why you built it
6. **How it works** — Brief explanation
7. **Quote from customer** — The outcome they achieved
8. **Call to action** — How to get started

Then add FAQs addressing customer concerns and internal questions.

> "The process forces you to slow down and define, in unambiguous terms, the problem you are solving for customers, the solution you are proposing, and why customers will use it."
> — Colin Bryar, Working Backwards

---

## Anti-Patterns

### Writing in Isolation

Bring design and engineering in early. A PRD written alone has weak buy-in.

### Treating It as a Contract

The PRD is a communication tool, not a legal document. If reality changes, update it.

### No Prototype

Prose is ambiguous. A clickable prototype shows exactly what you mean.

### Hiding Behind the Document

> "PRDs are not inherently bad... The problem is that in nearly every case, the PRD is written instead of product discovery work, rather than after."
> — Marty Cagan

The PRD documents what you learned. It doesn't replace learning.

### Premature Detail

Don't specify button colors when you haven't validated the problem exists.

---

## Checklist

Before sharing a PRD:

- [ ] Problem is clearly stated with evidence
- [ ] Non-goals are explicit
- [ ] Success criteria are measurable
- [ ] Solution is separate from problem
- [ ] Prototype exists (or is in progress)
- [ ] Open questions are surfaced
- [ ] Fits on one page (or close to it)
- [ ] Written in plain English, no jargon

---

## Related

- [Engineering Requirements Document](../dev/erd.md) - Technical counterpart to the PRD
- [Create Tickets from ERD](../dev/create-tickets-from-erd.md) - Break down ERDs into actionable tickets

---

## Sources

This guide synthesizes best practices from:

- [Marty Cagan, Silicon Valley Product Group](https://www.svpg.com/revisiting-the-product-spec/) — Original PRD framework, evolved views on discovery
- [Lenny Rachitsky](https://www.lennysnewsletter.com/p/my-favorite-templates-issue-37) — 1-pager template, problem statement focus
- [Shreyas Doshi](https://shreyasdoshi.com/) — Iterative writing, living documents (ex-Stripe, Twitter, Google)
- [Amazon Working Backwards](https://workingbackwards.com/resources/working-backwards-pr-faq/) — PR/FAQ process for new products
- [Intercom](https://www.cycle.app/blog/how-intercom-writes-product-requirements-documents-prd) — One-page "Intermission" format, job stories
- [Ben Horowitz](https://www.prodmgmt.world/blog/prd-template-guide) — "The PRD is the most important document a PM maintains"
- [Atlassian](https://www.atlassian.com/agile/product-management/requirements) — Agile requirements and living documents
- [Product School](https://productschool.com/blog/product-strategy/product-template-requirements-document-prd) — Modern PRD templates
