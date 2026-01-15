PRD: 0014
Title: Todo Subtasks
Author: Product
Status: Draft
ERD: [ERD-0014](../erd/0014-todo-subtasks.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Complex tasks often require multiple steps to complete, but users have no way to break down a todo into smaller, trackable pieces. Users either create multiple separate todos (losing the relationship between them) or try to track subtasks mentally or in the description field. This leads to todos that feel overwhelming, difficulty estimating progress, and no clear visibility into how much of a larger task is complete.

**Who has this problem?**

- Team members working on multi-step tasks who want to track incremental progress
- Users who prefer to break large tasks into actionable checklists
- Team leads who want visibility into task progress beyond just "pending" or "completed"
- Anyone who uses the todo description to list subtasks manually today

**Why solve it now?**

With search (PRD-0013), labels (PRD-0012), and comments (PRD-0011) now complete, the core todo experience is feature-rich but lacks task breakdown capabilities. Subtasks are a foundational feature of every major task management tool (Asana, Todoist, Linear, GitHub Issues). Users expect to be able to decompose work into smaller pieces.

---

## Non-Goals

- Nested subtasks (only one level deep keeps it simple)
- Subtask assignees (parent todo assignee is responsible)
- Subtask due dates (parent due date applies)
- Subtask labels or comments (keep subtasks lightweight)
- Converting subtasks to full todos (complexity, different data model)
- Drag-and-drop reordering of subtasks (manual ordering is sufficient)
- Subtask templates or presets
- Subtask progress in search results (search finds parent todos only)
- Real-time collaboration on subtasks (page refresh shows updates)

---

## Success Criteria

**Quantitative:**
- Users can add, edit, and delete subtasks on any todo
- Users can mark subtasks as complete/incomplete
- Progress indicator shows X of Y subtasks complete on todo cards
- Subtasks persist across todo edits
- Subtasks are visible in the todo edit/detail dialog
- Maximum 20 subtasks per todo (reasonable limit)

**Qualitative:**
- Breaking down tasks feels quick and natural
- Progress visibility motivates completion
- Subtasks are lightweight, not bureaucratic
- Users prefer native subtasks over description checklists

---

## Solution

**High-level approach**

Add a Subtask model linked to Todo. Display subtasks as a checklist in the todo edit dialog below the main form fields. Show a progress indicator on todo cards (e.g., "3/5" or a progress bar). Allow inline add/edit/delete of subtasks.

**User Stories**

```
When I have a complex task, I want to break it into subtasks, so I can track incremental progress.

When I complete part of a task, I want to check off the subtask, so I see my progress.

When I view the todo list, I want to see subtask progress, so I know which tasks need more work.

When I review a task, I want to see all its subtasks, so I understand the full scope of work.
```

**What's in scope**

- Subtask model (id, title, isComplete, todoId, order, createdAt)
- Subtask list in todo edit dialog with checkboxes
- Add subtask input (inline, at bottom of list)
- Edit subtask inline (click to edit)
- Delete subtask (X button)
- Toggle subtask completion (checkbox)
- Progress indicator on todo cards (e.g., "2/5" checkmark icon)
- Server actions for CRUD operations
- Order field for manual ordering (add at end)
- Subtasks visible to all tenant members (same access as parent todo)

**What's out of scope**

- Subtask reordering UI (add at bottom is sufficient)
- Bulk operations on subtasks
- Subtask notifications
- Subtask activity in comments
- Keyboard shortcuts for subtask management
- Subtask search
- Subtask analytics

---

## UI Patterns

**Todo Card**
- Small progress indicator beside existing metadata (comments, labels)
- Format: checkmark icon with "2/5" or similar
- Only shows if todo has subtasks
- Clicking card opens edit dialog with subtasks visible

**Todo Edit Dialog**
- Subtasks section below description field
- Header: "Subtasks (2/5)" showing completion count
- Checklist with checkboxes for each subtask
- Each subtask shows: checkbox, title, delete (X) button on hover
- Clicking title enters inline edit mode
- "Add subtask" input at bottom with + icon
- Press Enter or click + to add
- Empty subtask list shows placeholder: "No subtasks"

**Progress Indicator Variants**
- Text: "2/5" with checkmark icon (compact)
- Progress bar: small horizontal bar showing percentage (visual)
- Badge: "2/5 complete" (verbose)

Recommend text format "2/5" for space efficiency.

**Subtask States**
- Incomplete: unchecked checkbox, normal text
- Complete: checked checkbox, strikethrough text, muted color

---

## Data Model

**Subtask**
- `id` - unique identifier (cuid)
- `title` - subtask text (max 200 characters)
- `isComplete` - boolean, default false
- `order` - integer for sort order
- `todoId` - foreign key to parent todo
- `createdAt` - timestamp

Subtasks are deleted when parent todo is deleted (cascade).

---

## Behavior

- New todos have no subtasks by default
- Adding a subtask appends it to the end of the list
- Subtask order is preserved (not alphabetical)
- Completing all subtasks does NOT auto-complete the parent todo
- Completing the parent todo does NOT affect subtask state
- Subtasks count toward the "completion" feel but are independent
- Empty subtask titles are rejected (client-side validation)
- Maximum 20 subtasks per todo (server-side validation)

---

## Progress Calculation

- Show on todo card only if `subtaskCount > 0`
- Format: `completedCount/totalCount`
- Example: "3/5" means 3 of 5 subtasks complete
- No percentage or progress bar (keep it simple)

---

## Prototype

Implementation will use existing shadcn/ui components (Checkbox, Input, Button). The subtask list is a simple unordered list with inline editing.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model and tenant isolation
- PRD-0011 (Todo Comments) - establishes pattern for related lists in todo dialog
