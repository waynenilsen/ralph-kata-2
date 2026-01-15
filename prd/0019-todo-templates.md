PRD: 0019
Title: Todo Templates
Author: Product
Status: Draft
ERD: [ERD-0019](../erd/0019-todo-templates.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Users frequently create similar types of todos with the same structure: weekly reports with identical subtasks, project kickoff checklists with standard labels, bug reports with consistent fields. Currently, users must manually recreate this structure each time, typing the same subtasks, selecting the same labels, and filling in boilerplate descriptions. This repetitive work wastes time and leads to inconsistent task structures when users forget steps or take shortcuts.

**Who has this problem?**

- Team leads who create standard processes repeatedly (onboarding checklists, sprint planning tasks)
- Users with recurring workflows that have consistent structures (weekly reports, monthly reviews)
- Teams who want consistent task formats across members (bug reports, feature requests)
- Anyone who has "template" todos they copy and modify manually today

**Why solve it now?**

With subtasks (PRD-0014), labels (PRD-0012), and recurring todos (PRD-0015) now complete, users have rich todo structures but no way to reuse them. Templates are the natural complement to these features: define a structure once, instantiate it whenever needed. This is a standard feature in major task management tools (Asana templates, Notion templates, Linear project templates).

---

## Non-Goals

- Template marketplace or sharing between tenants
- Template versioning or history
- Nested templates (templates containing other templates)
- Template variables or dynamic fields (e.g., {{date}})
- Template scheduling (auto-create todos from template on schedule)
- Template folders or categories
- Template permissions different from todos
- Import/export templates
- Converting existing todos to templates (create templates from scratch only)
- Template analytics or usage tracking

---

## Success Criteria

**Quantitative:**
- Users can create templates with title, description, labels, and subtasks
- Users can view all their tenant's templates in a dedicated templates view
- Users can create a new todo from any template with one click
- Created todos have all template properties pre-filled
- Users can edit and delete templates
- Templates are tenant-scoped (visible to all team members)
- Maximum 50 templates per tenant (reasonable limit)

**Qualitative:**
- Creating standard todos feels effortless
- Teams trust that template-created todos are consistent
- Managing templates doesn't require navigating away from the main todo view
- Template creation feels intuitive, similar to creating a todo

---

## Solution

**High-level approach**

Add a TodoTemplate model that stores reusable todo structures (title, description, labels, subtasks). Provide a templates management page for CRUD operations. Add a "Create from Template" option in the todo creation flow. When a user creates from a template, pre-populate a new todo with the template's properties.

**User Stories**

```
When I create the same type of todo repeatedly, I want to save it as a template, so I don't have to rebuild the structure each time.

When I need to create a standard task, I want to select a template, so the todo is pre-populated with the right structure.

When our team process changes, I want to edit the template, so future todos reflect the updated structure.

When a template is no longer needed, I want to delete it, so it doesn't clutter the template list.
```

**What's in scope**

- TodoTemplate model (id, name, description, tenantId, createdById, createdAt, updatedAt)
- TemplateSubtask model (id, title, order, templateId)
- TemplateLabel junction (templateId, labelId)
- Templates list page (/templates)
- Create template dialog (name, description, labels, subtasks)
- Edit template dialog
- Delete template with confirmation
- "Create from Template" button/dropdown in todo creation area
- Template selection popover/dialog showing available templates
- Creating todo from template pre-fills: title, description, labels, subtasks
- Templates visible to all tenant members
- Server actions for template CRUD
- Server action to create todo from template

**What's out of scope**

- Template assignee (user selects assignee when creating)
- Template due date (user sets when creating)
- Template recurrence settings
- Duplicate template action
- Template search/filter
- Template usage count
- "Save as template" from existing todo
- Template preview before creating

---

## UI Patterns

**Templates Page**

- Accessible from navigation sidebar
- Header: "Templates" with "New Template" button
- Grid or list of template cards
- Each card shows: name, description preview, label count, subtask count
- Click card to edit, or use dropdown menu for edit/delete
- Empty state: "No templates yet. Create your first template to get started."

**Template Card**

- Template name (bold)
- Description preview (truncated, 2 lines max)
- Labels shown as colored dots or badges
- Subtask count indicator (e.g., "5 subtasks")
- Dropdown menu with Edit and Delete options

**Create/Edit Template Dialog**

- Similar layout to todo edit dialog
- Fields: Name (required), Description (optional)
- Labels section: multi-select from existing labels
- Subtasks section: add/edit/remove subtasks (same UI as todo subtasks)
- Save and Cancel buttons
- Maximum 20 subtasks per template (same as todos)

**Create from Template Flow**

- Option 1: "From Template" button next to "New Todo" button
  - Opens template selection dialog
  - Shows list/grid of available templates
  - Click template to create todo with pre-filled data
  - Todo edit dialog opens with template data pre-populated

- Option 2: Dropdown on "New Todo" button
  - "Blank Todo" option
  - Divider
  - List of available templates (up to 5, then "See all templates")
  - Click template to create with pre-filled data

Recommend Option 2 for fewer clicks in common case.

**Template Selection Dialog**

- Header: "Create from Template"
- Search/filter input (if many templates)
- List of template cards (name, description preview, label/subtask counts)
- Click to select and create
- Cancel button to close

---

## Data Model

**TodoTemplate**
- `id` - unique identifier (cuid)
- `name` - template name (max 100 characters, required)
- `description` - template description (max 2000 characters, optional)
- `tenantId` - foreign key to Tenant
- `createdById` - foreign key to User (creator)
- `createdAt` - timestamp
- `updatedAt` - timestamp

**TemplateSubtask**
- `id` - unique identifier (cuid)
- `title` - subtask text (max 200 characters)
- `order` - integer for sort order
- `templateId` - foreign key to TodoTemplate

**TemplateLabel** (junction table)
- `templateId` - foreign key to TodoTemplate
- `labelId` - foreign key to Label

Templates are deleted with cascade (subtasks and label associations deleted).

---

## Behavior

**Creating a Template**
- Name is required, description optional
- Labels selected from tenant's existing labels
- Subtasks added inline (same UX as todo subtasks)
- Template is immediately available to all tenant members

**Creating Todo from Template**
- New todo is created with:
  - Title = template name (user can modify)
  - Description = template description
  - Labels = template labels (automatically attached)
  - Subtasks = template subtasks (copied, all incomplete)
  - Status = PENDING
  - Due date = not set (user adds if needed)
  - Assignee = not set (user assigns if needed)
  - Recurrence = none
- Todo edit dialog opens with pre-filled data
- User can modify any field before saving
- User must explicitly save the new todo

**Editing a Template**
- All fields editable
- Changes do NOT affect todos already created from template
- Only affects future todos created from template

**Deleting a Template**
- Requires confirmation dialog
- Does NOT delete todos created from template
- Removes template from selection list

**Edge Cases**
- Template with label that gets deleted: label silently removed from template
- Maximum 50 templates per tenant: show error on create attempt
- Template with 0 subtasks: valid, just doesn't pre-populate subtasks
- Empty description: valid, description left empty on todo

---

## Prototype

Implementation will use existing shadcn/ui components (Dialog, Card, Button, Input, Textarea, Badge). The template management page follows similar patterns to the main todo list. Template creation dialog mirrors the todo edit dialog layout.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo and tenant models
- PRD-0012 (Todo Labels) - labels are copied to new todos
- PRD-0014 (Todo Subtasks) - subtasks are copied to new todos
