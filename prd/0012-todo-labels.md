PRD: 0012
Title: Todo Labels
Author: Product
Status: Draft
ERD: [ERD-0012](../erd/0012-todo-labels.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Users cannot categorize or tag their todos. As todo lists grow, it becomes difficult to distinguish between different types of work (bugs vs features, urgent vs low priority, different project areas). Users mentally track these categories but have no way to represent them in the system. Filtering by status and assignee alone is insufficient for complex workflows.

**Who has this problem?**

- Team members managing diverse types of work who need visual distinction between todo categories
- Team leads who want to see all "urgent" items or all "bugs" at a glance
- Users who work across multiple projects or areas and need to segment their todos
- Teams adopting lightweight workflows (kanban-style labels like "blocked", "in review")

**Why solve it now?**

With filtering, sorting, assignees, and comments now implemented, labels are the natural next categorization layer. Labels are a foundational feature of every popular task management tool (GitHub Issues, Trello, Linear) and a common user expectation. The filtering infrastructure can be extended to support label filtering.

---

## Non-Goals

- Hierarchical labels or label groups (flat list keeps it simple)
- Label colors assigned automatically (admin chooses colors)
- Multiple label selection in bulk operations (single todo at a time)
- Label-based automation (e.g., auto-assign based on label)
- Label templates or presets for new tenants
- Label analytics or reports
- Cross-tenant shared labels (each tenant manages their own)
- Emoji support in label names (text only)

---

## Success Criteria

**Quantitative:**
- Admins can create, edit, and delete labels for their tenant
- Users can apply zero or more labels to any todo
- Users can filter todos by label (single label filter)
- Labels display on todo cards with their assigned color
- Label management is accessible from settings or a dedicated page

**Qualitative:**
- Categorizing todos feels quick and natural
- Labels provide clear visual distinction on the todo list
- Teams can establish their own workflow conventions through labels

---

## Solution

**High-level approach**

Add a Label model scoped to tenants with name and color. Create a many-to-many relationship between Todo and Label. Extend the todo create/edit UI to include label selection. Add label filtering to the existing filter controls. Provide a label management interface for admins.

**User Stories**

```
When I create a todo, I want to add labels, so I can categorize the type of work.

When I view my todo list, I want to see labels on each card, so I can quickly identify work types.

When I need to focus on bugs, I want to filter by the "bug" label, so I only see relevant todos.

When I'm an admin, I want to create custom labels for my team, so we can establish our own workflow.
```

**What's in scope**

- Label model (id, name, color, tenantId, createdAt)
- TodoLabel join table for many-to-many relationship
- Label management page (admin only) at `/settings/labels` or `/labels`
- Create label form (name, color picker)
- Edit and delete labels
- Label selector in todo create/edit forms (multi-select)
- Label badges displayed on todo cards
- Filter by label (single label dropdown in filter bar)
- URL-based label filter state (`?label=<labelId>`)
- Default labels created for new tenants (optional, can be empty)

**What's out of scope**

- Multiple label filter (AND/OR logic)
- Label search/autocomplete
- Drag-and-drop label reordering
- Label descriptions
- Label usage statistics
- Bulk label operations
- Label keyboard shortcuts

---

## UI Patterns

**Todo Card**
- Display labels as small colored badges/chips below or beside the title
- Show label name inside the badge
- Limit display to 3-4 labels, show "+N more" if exceeded
- Badge background uses label color, text uses contrasting color

**Create/Edit Form**
- Multi-select dropdown labeled "Labels"
- Shows all tenant labels as checkboxes or chips
- Selected labels appear as removable chips above/below selector
- "Manage labels" link for admins to access label settings

**Filter Controls**
- New filter dropdown: "Label"
- Options: All, [list of tenant labels]
- Selecting a label filters to todos with that label

**Label Management (Admin)**
- List view of all tenant labels
- Each row shows: color swatch, name, edit button, delete button
- Add label button opens form with name input and color picker
- Delete confirmation warns about removing label from all todos
- Color picker offers preset colors (8-12 options) plus custom hex input

---

## Color Palette

Provide a default color palette for easy selection:
- Red (#ef4444) - urgent, bugs
- Orange (#f97316) - warnings, needs attention
- Yellow (#eab308) - in progress, pending
- Green (#22c55e) - done, approved
- Blue (#3b82f6) - feature, enhancement
- Purple (#a855f7) - design, UX
- Pink (#ec4899) - personal, misc
- Gray (#6b7280) - low priority, backlog

Users can also enter custom hex colors.

---

## Default Behavior

- New tenants start with no labels (clean slate)
- Labels are optional on todos (zero labels is valid)
- Any tenant member can apply labels to any todo
- Only admins can create, edit, or delete labels
- Deleting a label removes it from all todos (no cascade delete of todos)
- Label names must be unique within a tenant
- Label names are case-insensitive for uniqueness (but preserve display case)
- Maximum label name length: 30 characters

---

## Prototype

Implementation will use existing shadcn/ui components (Badge, Popover, Command for multi-select). Color picker can use a simple button grid or radix-ui/colors.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides tenant-scoped data model
- PRD-0002 (Todo Filtering and Sorting) - provides filter infrastructure to extend
- PRD-0008 (User Profile & Account Settings) - provides settings page pattern
