ERD: 0004
Title: Homepage Marketing Page
Author: Engineering
Status: Draft
PRD: [PRD-0004](../prd/0004-homepage-marketing-page.md)
Last Updated: 2026-01-14
Reviewers: []

---

## Overview

This document covers the technical implementation of replacing the default Next.js boilerplate homepage with a marketing landing page. This is a frontend-only change with no database modifications or new API endpoints.

---

## Background

The current homepage (`src/app/page.tsx`) displays the default Next.js template with links to Vercel and Next.js documentation. This needs to be replaced with a purpose-built marketing page that explains the product and drives users to signup/login.

Related:
- PRD-0004: Homepage Marketing Page
- Existing authentication flows at `/login` and `/register`

---

## Goals and Non-Goals

**Goals:**
- Create a professional marketing landing page
- Maintain consistency with existing app design (Tailwind, shadcn/ui)
- Ensure responsive design across devices
- Support dark mode
- Keep the page fast (no external dependencies)

**Non-Goals:**
- Adding new database models
- Creating new API endpoints
- Implementing analytics tracking
- Adding external services

---

## Constraints Checklist

- [x] Uses SQLite (N/A - no database changes)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

This is a purely frontend change. No architecture diagram needed.

```
┌─────────────────┐
│   Homepage      │
│   (static)      │
│                 │
│ ┌─────────────┐ │
│ │   Header    │ │──→ /login, /register
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │    Hero     │ │──→ /register (CTA)
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │  Features   │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │    CTA      │ │──→ /register
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │   Footer    │ │
│ └─────────────┘ │
└─────────────────┘
```

**Components**

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `page.tsx` | Main homepage layout | `src/app/page.tsx` |
| `Header` | Navigation with Login/Sign Up | inline or extracted |
| `Hero` | Headline, subheadline, CTA | inline or extracted |
| `Features` | Feature highlights grid | inline or extracted |
| `CTASection` | Secondary call-to-action | inline or extracted |
| `Footer` | Minimal footer links | inline or extracted |

**Implementation Decision:** Keep all sections inline in `page.tsx` initially. Extract to components only if reuse is needed or file becomes unwieldy. This avoids premature abstraction.

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Homepage shall display a hero section with headline, subheadline, and CTA button | Must |
| REQ-002 | Homepage shall display 3-4 feature highlights with icons and descriptions | Must |
| REQ-003 | Homepage shall include navigation links to /login and /register | Must |
| REQ-004 | Homepage shall be responsive (mobile, tablet, desktop breakpoints) | Must |
| REQ-005 | Homepage shall support dark mode using existing Tailwind dark: classes | Must |
| REQ-006 | Homepage shall use existing shadcn/ui Button component for CTAs | Should |
| REQ-007 | Homepage should include a footer with minimal links | Should |
| REQ-008 | Homepage may use Lucide icons for feature illustrations | May |

---

## API Design

No API changes required. This is a static page with links to existing routes.

---

## Data Model

No database changes required.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Extract each section to separate component files | Better organization, reusability | Premature abstraction, more files | Keep simple until needed |
| Use MDX for content | Easy content editing | Overkill for single page | Too much setup for one page |
| Add marketing-specific CSS file | Isolated styles | Inconsistent with Tailwind approach | Use Tailwind classes instead |

---

## Security Considerations

- No user input on this page
- No authentication required
- Links to /login and /register use existing secure flows
- No external scripts or resources

---

## Testing Strategy

- **Manual testing:** Verify all links work, responsive design at breakpoints
- **Visual inspection:** Dark mode toggle, mobile/desktop layouts
- **E2E tests:** Add basic test that homepage loads and contains expected elements

---

## Deployment

No special deployment considerations. Standard Next.js static page.

---

## Implementation Plan

The implementation should be done in vertical slices, with each ticket delivering a testable piece:

1. **Header Navigation** - Add header with logo/title and Login/Sign Up buttons
2. **Hero Section** - Add hero with headline, subheadline, and primary CTA
3. **Features Section** - Add feature highlights grid
4. **CTA + Footer** - Add secondary CTA and footer
5. **E2E Test** - Add basic homepage test

Each ticket builds on the previous, resulting in an incrementally better homepage.

---

## Related

- [PRD-0004: Homepage Marketing Page](../prd/0004-homepage-marketing-page.md)
- [Implement Ticket](../prompts/dev/implement-ticket.md)
- [Conventional Commits](../prompts/dev/conventional-commits.md)
