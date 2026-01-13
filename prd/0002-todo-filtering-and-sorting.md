PRD: 0002
Title: Todo Filtering and Sorting
Author: Product
Status: Draft
ERD: [ERD-0002](../erd/0002-todo-filtering-and-sorting.md)
Last Updated: 2026-01-13

---

## Problem

**What problem are we solving?**

As teams accumulate todos, finding relevant tasks becomes difficult. Users must scroll through all todos to find pending items, overdue tasks, or recently created work. This slows down daily task management.

**Who has this problem?**

Users of the multi-tenant todo application who have more than a handful of todos. The pain increases with team size and project duration.

**Why solve it now?**

With the core todo functionality complete (PRD-0001), users can now create many todos. Without filtering and sorting, the application becomes less useful as todo count grows.

---

## Non-Goals

- Full-text search (complex, requires different architecture)
- Saved filters / filter presets
- Advanced query builder UI
- Filtering by assignee (assignees not yet implemented)
- Filtering by labels/tags (labels not yet implemented)
- Export filtered results

---

## Success Criteria

**Quantitative:**
- Users can filter todos by status (All, Pending, Completed)
- Users can sort todos by creation date or due date
- Filter and sort state persists in URL (shareable)
- Page loads with filters applied in under 200ms

**Qualitative:**
- Users feel in control of their todo list
- Finding specific todos is intuitive
- UI feels responsive when changing filters

---

## Solution

**High-level approach**

Add client-side filter controls that update URL search parameters. Server component reads parameters and filters/sorts database query. No additional database tables required.

**User Stories**

```
When I have many todos, I want to filter by status, so I can focus on pending work.

When planning my week, I want to sort by due date, so I can see what's coming up.

When reviewing progress, I want to see only completed todos, so I can track what's done.

When sharing my view with a teammate, I want the URL to include my filters, so they see the same list.
```

**What's in scope**

- Filter by status: All, Pending, Completed
- Sort by: Created date (newest/oldest), Due date (soonest/furthest)
- URL-based state (e.g., `/todos?status=pending&sort=due-asc`)
- Filter/sort UI controls on the todos page
- Preserve existing todo list functionality

**What's out of scope**

- Pagination (can be added in future PRD)
- Date range filters (e.g., "todos due this week")
- Multiple simultaneous filters beyond status
- Remembering user's preferred default filter

---

## Prototype

TBD - UI mockup showing filter dropdowns above todo list.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) must be complete
