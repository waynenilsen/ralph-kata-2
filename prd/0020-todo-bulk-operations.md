PRD: 0020
Title: Todo Bulk Operations
Author: Product
Status: Draft
ERD: [ERD-0020](../erd/0020-todo-bulk-operations.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Users who manage many todos must perform repetitive actions one at a time. To archive 10 completed todos, they must click each one individually. To assign 5 tasks to a team member, they must open each task and select the assignee. To add a label to multiple related todos, they must edit each one separately. This repetitive work is time-consuming and frustrating, especially for users with high task volumes.

**Who has this problem?**

- Power users managing dozens or hundreds of todos
- Team leads who need to reassign work when team members change
- Users doing weekly cleanup of completed tasks
- Anyone organizing todos by adding labels or changing status in batches
- Teams migrating or reorganizing their task structure

**Why solve it now?**

With archives (PRD-0018), labels (PRD-0012), assignees (PRD-0010), and templates (PRD-0019) now complete, users have powerful organizational tools but no efficient way to apply them at scale. Bulk operations are a standard feature in every mature task management tool (Gmail, Todoist, Asana, Linear) and dramatically improve productivity for users with many todos.

---

## Non-Goals

- Bulk edit of todo titles or descriptions (too complex, open editing dialog instead)
- Bulk creation of todos (use templates for this)
- Undo bulk operations (archive is soft delete, provides recovery)
- Scheduled bulk operations (apply changes now only)
- Bulk operations across tenants (tenant-scoped only)
- Saved bulk operation presets or macros
- Bulk operations on subtasks (parent todos only)
- Keyboard-only selection mode (mouse selection first)
- Select all across pages (current page only)

---

## Success Criteria

**Quantitative:**
- Users can select multiple todos in the todo list view
- Users can select all visible todos with one click
- Users can clear selection with one click
- Users can perform these bulk actions: mark complete, mark pending, archive, delete, assign, unassign, add label, remove label
- Bulk actions apply to all selected todos atomically
- Selection persists while applying actions (can chain multiple actions)
- Selection count is visible when todos are selected

**Qualitative:**
- Selecting and acting on multiple todos feels fast and natural
- Users feel confident bulk actions will apply correctly
- The selection UI doesn't interfere with normal todo list usage
- Bulk operations feel safe (archive before delete, clear feedback)

---

## Solution

**High-level approach**

Add a selection mode to the todo list. When active, each todo card shows a checkbox. Users can click checkboxes to select individual todos, or use "Select all" to select all visible todos. A floating action bar appears at the bottom showing the selection count and available bulk actions. Clicking an action applies it to all selected todos.

**User Stories**

```
When I have many completed todos, I want to select them all and archive at once, so I don't waste time clicking each one.

When a team member leaves, I want to reassign all their todos to someone else, so work doesn't get lost.

When I'm organizing my work, I want to add a label to multiple related todos, so I can group them together efficiently.

When I select todos, I want to see how many are selected, so I know the scope of my action.
```

**What's in scope**

- Selection checkbox on each todo card (visible in selection mode)
- "Select" button to enter selection mode
- "Select All" button to select all visible todos
- "Clear Selection" button to deselect all
- "Cancel" button to exit selection mode
- Selection count indicator
- Floating action bar with bulk actions
- Bulk actions: Complete, Pending, Archive, Delete, Assign, Unassign, Add Label, Remove Label
- Server actions for each bulk operation
- Activity log entries for bulk operations (one per affected todo)
- Confirmation dialog for destructive actions (delete)

**What's out of scope**

- Drag to select (checkbox click only)
- Shift+click range selection (can add later)
- Bulk due date changes
- Bulk recurrence changes
- Bulk operations from search results (main list only for now)
- Bulk operations from archive view
- Persistent selection across page navigation

---

## UI Patterns

**Todo List Header**

- New "Select" button in header (enters selection mode)
- When in selection mode, header shows:
  - "Select All" button
  - "Clear" button
  - Selection count (e.g., "3 selected")
  - "Cancel" button (exits selection mode)

**Todo Card (Selection Mode)**

- Checkbox appears on left side of each card
- Clicking checkbox toggles selection
- Selected cards have subtle highlight (border or background)
- Clicking anywhere else on card still opens edit dialog

**Floating Action Bar**

- Fixed position at bottom of viewport
- Only visible when 1+ todos are selected
- Contains action buttons arranged horizontally
- Each button has icon and label
- Destructive actions (delete) styled differently

**Action Bar Layout**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  3 selected  │ Complete │ Pending │ Archive │ Assign │ Label │ Delete  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Assign Bulk Action**

- Opens dropdown/popover with tenant members list
- Click member to assign all selected todos to them
- "Unassign" option to remove assignee from all

**Label Bulk Action**

- Opens dropdown/popover with tenant labels
- Checkboxes for each label
- Add labels: check labels to add to selected todos
- Remove labels: uncheck to remove
- Labels already on some (not all) todos show indeterminate state

**Confirmation Dialogs**

- Delete: "Delete X todos? This will move them to trash."
- No confirmation for non-destructive actions (complete, archive, assign, label)

---

## Bulk Action Behavior

**Mark Complete**

- Sets status to COMPLETED for all selected todos
- Creates activity entry for each todo
- Does NOT trigger recurring todo generation (only individual completion does)

**Mark Pending**

- Sets status to PENDING for all selected todos
- Creates activity entry for each todo

**Archive**

- Sets archivedAt to current timestamp for all selected todos
- Creates activity entry for each todo
- Todos disappear from list (were filtered out)
- Selection clears after archive

**Delete (Soft)**

- Sets deletedAt to current timestamp for all selected todos
- Creates activity entry for each todo
- Todos move to trash
- Selection clears after delete

**Assign**

- Sets assigneeId to selected user for all selected todos
- Creates activity entry for each todo
- Creates notification for assignee (unless self-assignment)
- If assigning to self, no notifications

**Unassign**

- Clears assigneeId for all selected todos
- Creates activity entry for each todo

**Add Label**

- Creates TodoLabel records for selected todos
- Skips todos that already have the label
- Creates activity entry for each affected todo

**Remove Label**

- Deletes TodoLabel records for selected todos
- Skips todos that don't have the label
- Creates activity entry for each affected todo

---

## Edge Cases

**Empty selection**

- Action bar not shown
- Can't perform bulk actions

**Selection across filters**

- Changing filters clears selection
- Prevents confusing "where did my selection go" state

**Selection and pagination**

- Selection only includes visible page
- Navigating pages clears selection
- "Select All" only selects current page

**Todo already in target state**

- Mark complete on already complete todo: no-op, no activity
- Archive already archived todo: no-op
- Add label already present: no-op

**Concurrent edits**

- Bulk operations are atomic (transaction)
- If one todo fails validation, entire operation fails
- Error message shown to user

**Maximum selection**

- No artificial limit on selection count
- Limited by page size (performance naturally constrained)

---

## Performance

- Bulk operations execute in a single database transaction
- Activity entries created in batch insert
- Notifications created in batch insert
- No N+1 queries (single query updates)
- Maximum practical selection is page size (10-50 items)

---

## Prototype

Implementation will use existing shadcn/ui components (Checkbox, Button, Popover, DropdownMenu). The floating action bar uses fixed positioning. Selection state managed in React state (client-side).

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model
- PRD-0010 (Todo Assignees) - bulk assign requires assignees
- PRD-0012 (Todo Labels) - bulk label requires labels
- PRD-0017 (Todo Activity Log) - activity entries for bulk actions
- PRD-0018 (Todo Archives) - bulk archive requires archive feature

