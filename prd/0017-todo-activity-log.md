PRD: 0017
Title: Todo Activity Log
Author: Product
Status: Draft
ERD: [ERD-0017](../erd/0017-todo-activity-log.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

When collaborating on todos, users have no visibility into what changed, when, or by whom. If a due date shifts, an assignee changes, or a status updates, there's no record of the previous state. This makes it difficult to understand how a task evolved, audit decisions, or diagnose why something went wrong. Users are left asking "who changed this?" or "what was the original due date?" with no way to answer.

**Who has this problem?**

- Team leads who need accountability and audit trails for task changes
- Team members who want to understand the history of a task they're picking up
- Anyone debugging why a todo is in its current state
- Organizations with compliance needs requiring change tracking

**Why solve it now?**

With notifications (PRD-0016) shipping, users are alerted to assignments and comments. But notifications are ephemeral - once read, they're gone. An activity log provides the persistent record that notifications reference. Additionally, the todo system now has many editable fields (assignee, labels, due date, status, description) and understanding the full history of changes is increasingly valuable.

---

## Non-Goals

- Real-time activity feed (page refresh shows updates)
- Activity log for tenant-wide events (only per-todo activity)
- Undo/revert functionality (view history only)
- Activity log search or filtering
- Activity export (CSV, PDF)
- Blame/responsibility features beyond factual change tracking
- Activity for subtask changes (parent todo activity only)
- Activity aggregation or grouping ("3 changes by Alice")
- Custom activity retention periods (keep all history)
- Activity webhooks or external integrations

---

## Success Criteria

**Quantitative:**
- Users can view a chronological activity log for any todo
- Activity log shows: what changed, old value, new value, who changed it, when
- Activity is recorded for: creation, status changes, assignee changes, due date changes, label add/remove, description edits
- Activity log is accessible from the todo edit/detail dialog
- Activity entries are immutable (cannot be edited or deleted)
- Activity is created automatically - no manual logging required

**Qualitative:**
- Users feel confident they can trace the history of any task
- Understanding "what happened" to a todo feels quick and clear
- Activity log doesn't clutter the main todo UI
- Teams trust the audit trail is complete and accurate

---

## Solution

**High-level approach**

Create a TodoActivity model that records changes to todo fields. Generate activity entries automatically in server actions when todos are created or modified. Display activity in a dedicated section/tab within the todo edit dialog. Each entry shows the actor, action, timestamp, and relevant details.

**User Stories**

```
When I review a todo, I want to see its activity history, so I understand how it evolved.

When a due date changes, I want to know who changed it and when, so I can follow up.

When I pick up a task from someone else, I want to see what happened before, so I have context.

When auditing team work, I want a complete record of changes, so I can ensure accountability.
```

**What's in scope**

- TodoActivity model (id, todoId, actorId, action, field, oldValue, newValue, createdAt)
- Activity types: CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, DUE_DATE_CHANGED, LABELS_CHANGED, DESCRIPTION_CHANGED
- Automatic activity generation in existing server actions
- Activity list in todo edit dialog (collapsible section or tab)
- Actor name/email displayed for each entry
- Relative timestamps ("2 hours ago")
- Activity scoped to individual todos (not tenant-wide feed)

**What's out of scope**

- Activity for comment additions (comments are already visible)
- Activity for subtask changes
- Activity pagination (show all, typically <100 entries)
- Activity filtering by type or actor
- Notification integration (separate concern)
- Activity for bulk operations (log each todo individually)

---

## Activity Types

| Type | Trigger | Message Template |
|------|---------|------------------|
| CREATED | Todo created | "{actor} created this todo" |
| STATUS_CHANGED | Status field changed | "{actor} changed status from {old} to {new}" |
| ASSIGNEE_CHANGED | Assignee field changed | "{actor} assigned this to {new}" or "{actor} unassigned {old}" |
| DUE_DATE_CHANGED | Due date field changed | "{actor} changed due date from {old} to {new}" |
| LABELS_CHANGED | Labels added or removed | "{actor} added label {label}" or "{actor} removed label {label}" |
| DESCRIPTION_CHANGED | Description field changed | "{actor} updated the description" |

---

## UI Patterns

**Todo Edit Dialog**

- New "Activity" section below existing content (after subtasks, before save button)
- Collapsible with header: "Activity (12)" showing count
- Collapsed by default to reduce visual noise
- Expand to see chronological list (newest first)

**Activity Entry**

- Actor name/avatar (or initials)
- Action description (human-readable message)
- Relative timestamp ("2 hours ago", "Jan 15")
- No edit/delete controls (immutable)

**Entry Layout**

```
[Avatar] Alice Smith changed status from Pending to Completed
         2 hours ago

[Avatar] Bob Jones assigned this to Alice Smith
         Yesterday

[Avatar] Alice Smith created this todo
         Jan 10
```

**Empty State**

- If only creation exists: "No activity yet" (just show creation)
- Creation is always the first/oldest entry

---

## Data Model

**TodoActivity**
- `id` - unique identifier (cuid)
- `todoId` - foreign key to Todo
- `actorId` - foreign key to User (who made the change)
- `action` - enum (CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, DUE_DATE_CHANGED, LABELS_CHANGED, DESCRIPTION_CHANGED)
- `field` - optional string (the field name that changed)
- `oldValue` - optional string (previous value, JSON for complex types)
- `newValue` - optional string (new value, JSON for complex types)
- `createdAt` - timestamp

Activity entries are deleted when parent todo is deleted (cascade).

---

## Behavior

**Activity Generation**

- Server actions that modify todos also create activity entries
- Activity is created in the same transaction as the change
- CREATED action has no old/new values (just marks creation)
- STATUS_CHANGED records "PENDING" -> "COMPLETED" etc.
- ASSIGNEE_CHANGED records user IDs, displayed as names in UI
- DUE_DATE_CHANGED records ISO date strings
- LABELS_CHANGED records individual add/remove (one entry per label change)
- DESCRIPTION_CHANGED does NOT record full text (just notes it changed)

**Edge Cases**

- Self-assignment still logs (unlike notifications)
- Setting same value (no-op change) does NOT create activity
- Clearing a field (e.g., removing due date) logs as "removed due date"
- Bulk operations create individual activity per todo
- Activity actor is always the authenticated user

---

## Prototype

Implementation will use existing shadcn/ui components (Collapsible, ScrollArea). Actor avatars use initials (no image upload yet). Timestamps formatted with date-fns or similar.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo and user models
- PRD-0010 (Todo Assignees) - assignee changes trigger activity
- PRD-0012 (Todo Labels) - label changes trigger activity
