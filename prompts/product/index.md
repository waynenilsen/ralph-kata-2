# Product Documentation

Guides for product planning and requirements.

## Contents

- [Product Requirements Document](./prd.md) - How to write PRDs that get used

## Key Constraint

**No external services by default.** Projects must run immediately on checkout.

If a PRD requires external services (Auth0, Supabase, Stripe, etc.), it must be explicitly stated and justified.

## Related

- [Engineering Requirements Document](../dev/erd.md) - Technical counterpart to the PRD
- [Create Tickets from ERD](../dev/create-tickets-from-erd.md) - Break down ERDs into actionable tickets
- [Project Setup](../dev/setup.md) - The technical stack (Next.js, Prisma, SQLite, Sprite)
