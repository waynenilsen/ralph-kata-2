ERD: 0006
Title: Frontend UI Overhaul
Author: Engineering
Status: Draft
PRD: [PRD-0006](../prd/0006-frontend-ui-overhaul.md)
Last Updated: 2026-01-14
Reviewers: None

---

## Overview

This document describes the technical implementation for fixing UI inconsistencies and completing missing frontend elements. The changes are purely frontend - no backend modifications, no database changes.

---

## Background

The application has functional core features (auth, todos, filtering, pagination, invites) but the frontend has gaps:

- Homepage placeholder instead of actual content
- Auth pages lack cross-navigation (login ↔ register)
- Inconsistent branding ("Todo App" vs "TeamTodo")
- No navigation back to homepage from auth pages

Related documents:
- [PRD-0006](../prd/0006-frontend-ui-overhaul.md) - Product requirements
- [PRD-0004](../prd/0004-homepage-marketing-page.md) - Homepage content specification

---

## Goals and Non-Goals

**Goals:**
- Complete the homepage with hero section and feature highlights
- Add navigation links between login and register pages
- Unify branding to "TeamTodo" across all pages
- Add header navigation to auth pages

**Non-Goals:**
- Redesign existing components (cards, forms, buttons)
- Change color palette or typography
- Add new features or backend functionality
- Mobile-specific layouts beyond existing responsive design

---

## Constraints Checklist

- [x] Uses SQLite (not applicable - frontend only)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

No architectural changes. All modifications are to existing React components.

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
├─────────────────────────────────────────────────┤
│  Homepage       Auth Pages       App Layout      │
│  ┌─────────┐   ┌───────────┐   ┌────────────┐  │
│  │ Header  │   │ AuthHeader│   │ AppHeader  │  │
│  │ Hero    │   │ Form Card │   │ Content    │  │
│  │Features │   │ NavLinks  │   └────────────┘  │
│  │ CTA     │   └───────────┘                    │
│  └─────────┘                                    │
└─────────────────────────────────────────────────┘
```

**Components**

| Component | Location | Change |
|-----------|----------|--------|
| Homepage | `src/app/page.tsx` | Add hero section, features, CTA |
| LoginPage | `src/app/login/page.tsx` | Add link to register |
| RegisterPage | `src/app/register/page.tsx` | Add link to login |
| InvitePage | `src/app/invite/[token]/page.tsx` | Add header with logo |
| AppLayout | `src/app/(app)/layout.tsx` | Change "Todo App" to "TeamTodo" |

**Data Flow**

No data flow changes. All modifications are presentational.

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Homepage shall display hero section with headline, subheadline, and CTA | Must |
| REQ-002 | Homepage shall display 4 feature highlights with icons | Must |
| REQ-003 | Homepage shall display secondary CTA section | Should |
| REQ-004 | Login page shall include link to register page | Must |
| REQ-005 | Register page shall include link to login page | Must |
| REQ-006 | Invite page shall include header with TeamTodo branding | Should |
| REQ-007 | App layout header shall display "TeamTodo" instead of "Todo App" | Must |
| REQ-008 | All navigation links shall be accessible via keyboard | Must |

---

## API Design

No API changes. This is a frontend-only implementation.

---

## Data Model

No database changes. This is a frontend-only implementation.

---

## Implementation Details

### Homepage (REQ-001, REQ-002, REQ-003)

Replace the placeholder content in `src/app/page.tsx`:

```tsx
// Hero Section
<section className="py-20 text-center">
  <h1 className="text-4xl font-bold mb-4">
    Simple task management for teams
  </h1>
  <p className="text-xl text-muted-foreground mb-8">
    No complexity. No configuration. Just tasks that get done.
  </p>
  <div className="flex gap-4 justify-center">
    <Button asChild size="lg">
      <Link href="/register">Get Started</Link>
    </Button>
    <Button variant="outline" asChild size="lg">
      <Link href="/login">Sign In</Link>
    </Button>
  </div>
</section>

// Feature Highlights (4 items with icons)
<section className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
  {features.map(feature => (
    <div key={feature.title} className="text-center">
      <feature.icon className="mx-auto mb-4 h-12 w-12" />
      <h3 className="font-semibold mb-2">{feature.title}</h3>
      <p className="text-muted-foreground">{feature.description}</p>
    </div>
  ))}
</section>

// Secondary CTA
<section className="py-16 text-center bg-muted rounded-lg">
  <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
  <Button asChild size="lg">
    <Link href="/register">Create Free Account</Link>
  </Button>
</section>
```

### Auth Page Navigation Links (REQ-004, REQ-005)

Add footer text below the form in login and register pages:

```tsx
// In LoginPage, after </form>:
<p className="text-center text-sm text-muted-foreground mt-4">
  Don&apos;t have an account?{' '}
  <Link href="/register" className="text-primary hover:underline">
    Sign up
  </Link>
</p>

// In RegisterPage, after </form>:
<p className="text-center text-sm text-muted-foreground mt-4">
  Already have an account?{' '}
  <Link href="/login" className="text-primary hover:underline">
    Log in
  </Link>
</p>
```

### Invite Page Header (REQ-006)

Add a minimal header to the invite page:

```tsx
// Before the Card component:
<header className="absolute top-0 left-0 right-0 p-4">
  <Link href="/" className="text-xl font-bold">
    TeamTodo
  </Link>
</header>
```

### App Layout Branding (REQ-007)

In `src/app/(app)/layout.tsx`, change:

```tsx
// Before:
<h1 className="font-semibold">Todo App</h1>

// After:
<Link href="/" className="font-semibold text-lg">TeamTodo</Link>
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Create shared AuthLayout component | DRY header code | More files | Overhead for 3 pages |
| Use Lucide icons for features | Consistent with shadcn | Need to choose icons | Accepted - will use |
| Add footer to all pages | More complete | Scope creep | Out of scope per PRD |

---

## Security Considerations

- No security implications - all changes are presentational
- Navigation links are to existing authenticated/public routes
- No new data exposure or user input handling

---

## Testing Strategy

**Unit Tests:**
- Not required for presentational changes

**E2E Tests:**
- Existing e2e tests verify page navigation works
- Update `e2e/example.e2e.ts` to verify homepage content exists
- Add test for login → register navigation
- Add test for register → login navigation

```typescript
// e2e/navigation.e2e.ts
test('can navigate from login to register', async ({ page }) => {
  await page.goto('/login');
  await page.click('text=Sign up');
  await expect(page).toHaveURL('/register');
});

test('can navigate from register to login', async ({ page }) => {
  await page.goto('/register');
  await page.click('text=Log in');
  await expect(page).toHaveURL('/login');
});

test('homepage displays hero content', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('task management');
  await expect(page.getByRole('link', { name: 'Get Started' })).toBeVisible();
});
```

---

## Deployment

No deployment changes. Standard Next.js static/SSR rendering.

---

## Dependencies

- Lucide React icons (already in project via shadcn/ui)
- No new dependencies required
