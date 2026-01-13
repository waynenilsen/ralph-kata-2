PRD: 0001
Title: Multi-Tenant Todo Application
Author: Product
Status: Draft
ERD: [ERD-0001](../erd/0001-multi-tenant-todo.md)
Last Updated: 2026-01-13

---

## Problem

**What problem are we solving?**

Teams need a simple way to manage tasks without the complexity of enterprise project management tools. Existing solutions are either too basic (single-user) or too complex (Jira, Asana).

**Who has this problem?**

Small teams and organizations who want shared task management with clear boundaries between different teams/organizations using the same application.

**Why solve it now?**

This is the foundational feature for the application. Everything else builds on top of tenant-isolated task management.

---

## Non-Goals

- External authentication providers (Auth0, Clerk)
- External databases (Supabase, PlanetScale)
- Real-time collaboration / live updates
- File attachments
- Comments or activity feeds
- Integrations with external services
- Mobile applications

---

## Success Criteria

**Quantitative:**
- Users can create, read, update, and delete todos within their tenant
- Zero data leakage between tenants
- Application runs immediately on checkout with no configuration

**Qualitative:**
- Users feel confident their data is isolated from other organizations
- Task management feels fast and simple

---

## Solution

**High-level approach**

Single SQLite database with tenant isolation via application-level filtering. Each query includes tenant context. Users authenticate with email/password and belong to exactly one tenant.

**User Stories**

```
When I'm managing my team's work, I want to create and organize todos, so I can track what needs to be done.

When I complete a task, I want to mark it as done, so my team knows the status.

When I join my organization, I want to see only my organization's todos, so I'm not confused by other tenants' data.
```

**What's in scope**

- Tenant management (create tenant, invite users)
- User authentication (email/password, session-based)
- Todo CRUD (create, read, update, delete)
- Todo status (pending, completed)
- Basic todo fields (title, description, due date, status)
- Tenant-scoped data access
- Two roles: Admin (can invite users) and Member
- Self-service tenant signup (creates tenant + admin user)
- Admin invite flow for adding members to existing tenant

**What's out of scope**

- Subtasks or task hierarchies
- Labels/tags
- Assignees (beyond the todo creator)
- Search and filtering beyond status
- Bulk operations

---

## Prototype

TBD — to be created during design phase.

---

## Dependencies

None — this is the foundational feature.
