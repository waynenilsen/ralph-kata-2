PRD: 0004
Title: Homepage Marketing Page
Author: Product
Status: Draft
ERD: [ERD-0004](../erd/0004-homepage-marketing-page.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

The current homepage displays the default Next.js boilerplate template, which provides no value to visitors. Users landing on the site have no idea what the product does, why they should care, or how to get started. This creates a poor first impression and likely results in high bounce rates.

**Who has this problem?**

Potential new users visiting the site for the first time who need to understand:
- What the product is
- Why they should use it over alternatives
- How to sign up or log in

**Why solve it now?**

The homepage is the front door to the application. Every other feature we've built (todos, filtering, pagination, authentication) is invisible to users who bounce because the homepage doesn't explain the product.

---

## Non-Goals

- External analytics services (Google Analytics, Mixpanel)
- External CMS for content management
- A/B testing infrastructure
- Blog or content section
- Pricing page (the app is free/single-tier for now)
- Feature comparison with competitors
- Animated illustrations or complex graphics
- Newsletter signup

---

## Success Criteria

**Quantitative:**
- Homepage clearly communicates product value in under 5 seconds of reading
- Clear CTAs lead to signup and login flows
- Page loads fast (no external dependencies)

**Qualitative:**
- First-time visitors understand what the product does
- The design feels professional and trustworthy
- Navigation to signup/login is obvious

---

## Solution

**High-level approach**

Replace the default Next.js template with a purpose-built marketing landing page that explains the product, highlights key features, and provides clear calls-to-action for signup and login. Use existing shadcn/ui components for consistency.

**User Stories**

```
When I visit the homepage for the first time, I want to quickly understand what the product does, so I can decide if it's relevant to me.

When I'm convinced the product is useful, I want to easily find how to sign up, so I can start using it.

When I'm an existing user returning to the site, I want to easily find the login button, so I can access my todos.
```

**What's in scope**

- Hero section with headline, subheadline, and primary CTA
- Brief feature highlights (3-4 key features with icons)
- Secondary CTA section reinforcing signup
- Header navigation with Login/Sign Up buttons
- Footer with minimal links
- Responsive design (mobile, tablet, desktop)
- Dark mode support (consistent with app)

**What's out of scope**

- Testimonials (we don't have users yet)
- Screenshots of the app (requires separate design work)
- Detailed feature pages
- Pricing information
- Contact form
- Social proof sections

---

## Content

**Hero Section**
- Headline: Focus on the core value proposition (simple team task management)
- Subheadline: Expand on the problem being solved
- Primary CTA: "Get Started" → links to /register
- Secondary CTA: "Sign In" → links to /login

**Feature Highlights**
3-4 features that differentiate the product:
1. Team Isolation - Each team's todos are private
2. Simple by Design - No bloat, just tasks
3. Instant Setup - No configuration required
4. Works Offline - SQLite-backed, no cloud dependency

**Secondary CTA**
Reinforce the value and repeat the signup CTA at the bottom of the page.

---

## Prototype

TBD — to be created during implementation using existing shadcn/ui components.

---

## Dependencies

None — this is a frontend-only change with no backend requirements.
