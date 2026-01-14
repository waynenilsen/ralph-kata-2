PRD: 0006
Title: Frontend UI Overhaul
Author: Product
Status: Draft
ERD: [ERD-0006](../erd/0006-frontend-ui-overhaul.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

The current frontend has several UX inconsistencies and incomplete areas that create a fragmented user experience:

1. The homepage shows only a placeholder ("Hero section coming soon...") despite having header navigation
2. Auth pages (login, register, invite) lack navigation back to the homepage or between each other
3. The authenticated app layout uses generic branding ("Todo App") inconsistent with the homepage ("TeamTodo")
4. No visual way for users on the login page to find registration, or vice versa

**Who has this problem?**

All users interacting with the application:
- New visitors who land on an incomplete homepage
- Users who navigate to login but need to register (or vice versa)
- Authenticated users who see inconsistent branding between public and private pages

**Why solve it now?**

The core functionality (todos, filtering, pagination, auth, invites) is complete. Before adding more features (email system), we should ensure the existing UI is polished and consistent. A poor first impression undermines all the work we've done.

---

## Non-Goals

- Complete redesign of existing components (cards, buttons, forms work fine)
- New color schemes or theme changes (existing Tailwind/shadcn styling is acceptable)
- Mobile-specific layouts (responsive design exists, just needs consistency)
- New features or functionality beyond UI fixes
- Animated transitions or micro-interactions
- External design tools or Figma integration

---

## Success Criteria

**Quantitative:**
- All pages have consistent navigation to key destinations
- Users can navigate from login to register and vice versa in one click
- Homepage displays meaningful content instead of placeholder
- App branding is consistent across all pages ("TeamTodo" everywhere)

**Qualitative:**
- Users feel the application is polished and complete
- Navigation feels intuitive - users can always find their way
- Branding feels cohesive across public and authenticated pages

---

## Solution

**High-level approach**

Make targeted component-level improvements to fix UX gaps without wholesale redesign. Focus on navigation consistency, completing the homepage content, and unifying branding.

**User Stories**

```
When I'm on the homepage, I want to see what the product does, so I can decide whether to sign up.

When I'm on the login page and don't have an account, I want to easily find the registration link, so I can create an account.

When I'm on the register page and already have an account, I want to easily find the login link, so I can sign in.

When I'm using the app after login, I want to see consistent branding, so I feel confident I'm using the same product.
```

**What's in scope**

1. **Homepage completion** - Add hero section, feature highlights, and secondary CTA per PRD-0004
2. **Auth page navigation** - Add "Already have an account? Log in" / "Don't have an account? Sign up" links
3. **App layout branding** - Change "Todo App" to "TeamTodo" in authenticated header
4. **Auth page headers** - Add minimal header with TeamTodo logo/link back to homepage
5. **Navigation consistency** - Ensure all pages have clear paths to key destinations

**What's out of scope**

- Redesigning the todo cards, forms, or filters
- Adding new pages or features
- Changing the color palette or typography
- Footer content on auth pages
- Social login options
- Password reset flow (separate feature)

---

## Content

**Homepage Hero Section** (per PRD-0004)
- Headline: "Simple task management for teams"
- Subheadline: "No complexity. No configuration. Just tasks that get done."
- Primary CTA: "Get Started" → /register
- Secondary link: "Already have an account? Sign In" → /login

**Homepage Feature Highlights**
- Team Isolation - Each team's todos are private
- Simple by Design - No bloat, just tasks
- Instant Setup - No configuration required
- Works Offline - SQLite-backed, no cloud dependency

**Auth Page Links**
- Login page: "Don't have an account? Sign up" → /register
- Register page: "Already have an account? Log in" → /login
- Invite page: Minimal header with TeamTodo link to homepage

---

## Prototype

Implementation will use existing shadcn/ui components. No external design required.

---

## Dependencies

- PRD-0004 (Homepage Marketing Page) defines the content for the homepage hero and features
- Existing shadcn/ui component library
