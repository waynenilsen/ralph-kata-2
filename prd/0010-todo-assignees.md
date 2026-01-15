PRD: 0010
Title: Todo Assignees
Author: Product
Status: Draft
ERD: [ERD-0010](../erd/0010-todo-assignees.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Todos are currently associated only with their creator. In a team environment, tasks are often delegated to specific team members, but there's no way to indicate who is responsible for completing a todo. Team leads cannot assign work, and team members cannot see which tasks are theirs to complete. This limits the application's usefulness for team collaboration.

**Who has this problem?**

- Team leads and admins who need to delegate tasks to specific team members
- Team members who need to quickly see their assigned work
- All users in multi-member tenants who want clear accountability for tasks

**Why solve it now?**

The core todo functionality is stable with filtering, sorting, and pagination in place. The user system supports multiple members per tenant via invites. Adding assignees is the natural next step to enable true team collaboration and makes the existing filtering infrastructure more valuable.

---

## Non-Goals

- Multiple assignees per todo (one owner keeps accountability clear)
- Workload balancing or capacity planning
- Assignment notifications via email (can be added in future PRD)
- Assignment history or audit trail
- Auto-assignment rules
- Due date adjustment based on assignee availability
- Assignee suggestions based on past work

---

## Success Criteria

**Quantitative:**
- Users can assign any tenant member to a todo
- Users can filter todos by assignee (My Todos, Unassigned, All, specific user)
- Assignee is displayed on todo cards
- Assignee filter state persists in URL (shareable)
- Any tenant member can reassign any todo within the tenant

**Qualitative:**
- Team members feel clear ownership of their assigned tasks
- Finding "my work" is fast and intuitive
- Assignment workflow feels lightweight, not bureaucratic

---

## Solution

**High-level approach**

Add an optional `assigneeId` field to the Todo model referencing a User. Extend the todo creation and edit UI to include an assignee dropdown populated with tenant members. Add assignee filtering to the existing filter controls. Display assignee avatar/name on todo cards.

**User Stories**

```
When I create a todo for someone else, I want to assign it to them, so they know it's their responsibility.

When I view my todos, I want to filter to only my assigned tasks, so I can focus on my work.

When I'm a team lead, I want to see unassigned todos, so I can delegate work that hasn't been claimed.

When I complete someone else's task, I want to reassign it to myself first, so the record is accurate.
```

**What's in scope**

- Add `assigneeId` optional field to Todo model
- Assignee dropdown in todo create form (populated with tenant members)
- Assignee dropdown in todo edit/detail view
- Assignee display on todo cards (name or email, with avatar placeholder)
- Filter by assignee: My Todos, Unassigned, All, [specific user dropdown]
- URL-based assignee filter state (`?assignee=me`, `?assignee=unassigned`, `?assignee=<userId>`)
- Server action to update assignee
- "Assign to me" quick action on unassigned todos

**What's out of scope**

- Email notifications when assigned (future PRD)
- Bulk assignment operations
- Assignment permissions (any member can assign/reassign)
- Assignee avatars/profile pictures (not implemented yet)
- Assignment due date suggestions
- Workload visibility across team

---

## UI Patterns

**Todo Card**
- Show assignee name/email below or beside the todo title
- If unassigned, show "Unassigned" in muted text or omit
- Consider showing first letter avatar circle as visual indicator

**Create/Edit Form**
- Dropdown labeled "Assign to" with options:
  - Unassigned (default for create)
  - [Current user's name] (self-assign)
  - [Other tenant members]
- Searchable if team is large (optional enhancement)

**Filter Controls**
- New filter dropdown: "Assignee"
- Options: All, My Todos, Unassigned, [list of tenant members]
- "My Todos" is the common quick-access pattern

---

## Default Behavior

- New todos are **unassigned** by default
- Creator is NOT auto-assigned (explicit assignment required)
- Any tenant member can view all todos regardless of assignment
- Any tenant member can assign/reassign any todo

---

## Prototype

Implementation will use existing shadcn/ui Select component for dropdowns. No external design required.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model and user/tenant relationship
- PRD-0002 (Todo Filtering and Sorting) - provides filter infrastructure to extend
