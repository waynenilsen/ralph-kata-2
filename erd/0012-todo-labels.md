ERD: 0012
Title: Todo Labels
Author: Engineering
Status: Draft
PRD: [PRD-0012](../prd/0012-todo-labels.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding labels to todos. Labels allow users to categorize and tag todos for better organization and filtering. Labels are tenant-scoped, have customizable colors, and support many-to-many relationships with todos.

---

## Background

- PRD-0012 defines the product requirements for todo labels
- PRD-0001 established the multi-tenant todo system with Tenant, User, and Todo models
- PRD-0002 established the filtering infrastructure that will be extended for label filtering
- Labels are a standard feature in task management tools (GitHub Issues, Trello, Linear)

---

## Goals and Non-Goals

**Goals:**
- Add Label model scoped to tenants with name and color
- Create many-to-many relationship between Todo and Label
- Allow any tenant member to apply labels to todos
- Allow admins to create, edit, and delete labels
- Add label filtering to the existing filter controls
- Display labels on todo cards as colored badges

**Non-Goals:**
- Hierarchical labels or label groups
- Multiple label filtering with AND/OR logic
- Label-based automation
- Bulk label operations
- Real-time updates
- Label search/autocomplete

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Todo Card  │────▶│ Edit Dialog │────▶│   Labels    │
│  (badges)   │     │  + Labels   │     │  Selector   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Filter    │
│   Controls  │
└─────────────┘
       │
┌──────┴──────┐     ┌─────────────┐
│   Server    │────▶│   Prisma    │
│   Actions   │     │   Label     │
└─────────────┘     │  TodoLabel  │
                    └─────────────┘

┌─────────────────────────────────────┐
│         Admin Settings              │
│  /settings/labels                   │
│  - Create/Edit/Delete Labels        │
└─────────────────────────────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Label model | Stores label data with tenant relationship |
| TodoLabel join table | Many-to-many relationship between Todo and Label |
| createLabel action | Server action to create a new label (admin only) |
| updateLabel action | Server action to update label name/color (admin only) |
| deleteLabel action | Server action to delete a label (admin only) |
| updateTodoLabels action | Server action to set labels on a todo |
| LabelBadge | Renders a single colored label badge |
| LabelSelector | Multi-select component for choosing labels |
| LabelManagementPage | Admin page to manage tenant labels |
| LabelFilter | Dropdown in filter bar for filtering by label |

**Data Flow**

1. **Applying Labels to Todos:**
   - User opens todo edit dialog
   - Dialog fetches todo with labels included
   - LabelSelector shows all tenant labels with current selections
   - User toggles label selections
   - updateTodoLabels action updates the join table
   - Page revalidates, showing updated labels

2. **Filtering by Label:**
   - User selects a label from filter dropdown
   - URL updates with `?label=<labelId>`
   - Server query filters todos by label relationship
   - Filtered todo list renders

3. **Managing Labels (Admin):**
   - Admin navigates to /settings/labels
   - Page shows all tenant labels with edit/delete options
   - Admin can create new labels with name and color
   - Changes immediately reflected in label management and todo forms

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Label model shall have id, name, color, tenantId, createdAt fields | Must |
| REQ-002 | Label names shall be unique within a tenant (case-insensitive) | Must |
| REQ-003 | Label names shall have maximum length of 30 characters | Must |
| REQ-004 | TodoLabel join table shall link Todo and Label with composite key | Must |
| REQ-005 | Deleting a label shall remove it from all todos (not cascade delete todos) | Must |
| REQ-006 | Only admin users shall create, edit, or delete labels | Must |
| REQ-007 | Any tenant member shall apply labels to any todo | Must |
| REQ-008 | Todo cards shall display label badges with assigned colors | Must |
| REQ-009 | Label filter shall support single label selection | Must |
| REQ-010 | Label color shall be stored as hex string (e.g., "#ef4444") | Must |
| REQ-011 | Labels should load with todo in single query (no N+1) | Should |
| REQ-012 | Todo cards should show max 3-4 labels with "+N more" overflow | Should |
| REQ-013 | Label selector should show labels sorted alphabetically | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/labels.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

export type LabelState = {
  success?: boolean;
  error?: string;
};

// Create a new label (admin only)
export async function createLabel(
  _prevState: LabelState,
  formData: FormData
): Promise<LabelState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }
  if (session.user.role !== 'ADMIN') {
    return { error: 'Only admins can create labels' };
  }

  const name = (formData.get('name') as string)?.trim();
  const color = formData.get('color') as string;

  if (!name) {
    return { error: 'Label name is required' };
  }
  if (name.length > 30) {
    return { error: 'Label name must be 30 characters or less' };
  }
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { error: 'Invalid color format' };
  }

  // Check for duplicate name (case-insensitive)
  const existing = await prisma.label.findFirst({
    where: {
      tenantId: session.user.tenantId,
      name: { equals: name, mode: 'insensitive' },
    },
  });
  if (existing) {
    return { error: 'A label with this name already exists' };
  }

  await prisma.label.create({
    data: {
      name,
      color,
      tenantId: session.user.tenantId,
    },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');
  return { success: true };
}

// Update a label (admin only)
export async function updateLabel(
  labelId: string,
  _prevState: LabelState,
  formData: FormData
): Promise<LabelState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }
  if (session.user.role !== 'ADMIN') {
    return { error: 'Only admins can update labels' };
  }

  const name = (formData.get('name') as string)?.trim();
  const color = formData.get('color') as string;

  if (!name) {
    return { error: 'Label name is required' };
  }
  if (name.length > 30) {
    return { error: 'Label name must be 30 characters or less' };
  }
  if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return { error: 'Invalid color format' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true },
  });
  if (!label || label.tenantId !== session.user.tenantId) {
    return { error: 'Label not found' };
  }

  // Check for duplicate name (case-insensitive), excluding current label
  const existing = await prisma.label.findFirst({
    where: {
      tenantId: session.user.tenantId,
      name: { equals: name, mode: 'insensitive' },
      id: { not: labelId },
    },
  });
  if (existing) {
    return { error: 'A label with this name already exists' };
  }

  await prisma.label.update({
    where: { id: labelId },
    data: { name, color },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');
  return { success: true };
}

// Delete a label (admin only)
export async function deleteLabel(labelId: string): Promise<LabelState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }
  if (session.user.role !== 'ADMIN') {
    return { error: 'Only admins can delete labels' };
  }

  // Verify label belongs to user's tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true },
  });
  if (!label || label.tenantId !== session.user.tenantId) {
    return { error: 'Label not found' };
  }

  // Delete label (cascade deletes TodoLabel entries)
  await prisma.label.delete({
    where: { id: labelId },
  });

  revalidatePath('/settings/labels');
  revalidatePath('/todos');
  return { success: true };
}

// Update labels on a todo (any tenant member)
export async function updateTodoLabels(
  todoId: string,
  labelIds: string[]
): Promise<LabelState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });
  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  // Verify all labels belong to the same tenant
  if (labelIds.length > 0) {
    const labels = await prisma.label.findMany({
      where: {
        id: { in: labelIds },
        tenantId: session.user.tenantId,
      },
    });
    if (labels.length !== labelIds.length) {
      return { error: 'Invalid labels' };
    }
  }

  // Replace all labels on the todo
  await prisma.$transaction([
    prisma.todoLabel.deleteMany({ where: { todoId } }),
    ...labelIds.map((labelId) =>
      prisma.todoLabel.create({ data: { todoId, labelId } })
    ),
  ]);

  revalidatePath('/todos');
  return { success: true };
}
```

### Data Fetching

Extend existing todo queries to include labels:

```typescript
// When fetching todos for list
const todos = await prisma.todo.findMany({
  where: {
    tenantId,
    ...(labelId && {
      labels: {
        some: { labelId },
      },
    }),
  },
  include: {
    assignee: true,
    createdBy: true,
    _count: { select: { comments: true } },
    labels: {
      include: {
        label: true,
      },
    },
  },
});

// When fetching labels for tenant
const labels = await prisma.label.findMany({
  where: { tenantId },
  orderBy: { name: 'asc' },
});
```

---

## Data Model

### New Prisma Schema

```prisma
// prisma/label.prisma
model Label {
  id        String      @id @default(cuid())
  name      String
  color     String      // Hex color code, e.g., "#ef4444"
  tenant    Tenant      @relation(fields: [tenantId], references: [id])
  tenantId  String
  todos     TodoLabel[]
  createdAt DateTime    @default(now())

  @@unique([tenantId, name])
  @@index([tenantId])
}

model TodoLabel {
  todo    Todo   @relation(fields: [todoId], references: [id], onDelete: Cascade)
  todoId  String
  label   Label  @relation(fields: [labelId], references: [id], onDelete: Cascade)
  labelId String

  @@id([todoId, labelId])
  @@index([labelId])
}
```

### Model Updates

```prisma
// prisma/todo.prisma - add relation
model Todo {
  // ... existing fields ...
  labels TodoLabel[]
}

// prisma/tenant.prisma - add relation
model Tenant {
  // ... existing fields ...
  labels Label[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### LabelBadge

```typescript
// components/label-badge.tsx
import { cn } from '@/lib/utils';

type LabelBadgeProps = {
  name: string;
  color: string;
  className?: string;
};

function getContrastColor(hexColor: string): string {
  // Convert hex to RGB and calculate luminance
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export function LabelBadge({ name, color, className }: LabelBadgeProps) {
  const textColor = getContrastColor(color);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        className
      )}
      style={{ backgroundColor: color, color: textColor }}
    >
      {name}
    </span>
  );
}
```

### LabelSelector

```typescript
// app/(app)/todos/label-selector.tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { LabelBadge } from '@/components/label-badge';
import { cn } from '@/lib/utils';

type Label = {
  id: string;
  name: string;
  color: string;
};

type LabelSelectorProps = {
  labels: Label[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function LabelSelector({
  labels,
  selectedIds,
  onSelectionChange,
  disabled,
}: LabelSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleLabel = (labelId: string) => {
    const newSelection = selectedIds.includes(labelId)
      ? selectedIds.filter((id) => id !== labelId)
      : [...selectedIds, labelId];
    onSelectionChange(newSelection);
  };

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start"
          disabled={disabled}
        >
          {selectedLabels.length === 0 ? (
            <span className="text-muted-foreground">Select labels...</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.slice(0, 3).map((label) => (
                <LabelBadge key={label.id} name={label.name} color={label.color} />
              ))}
              {selectedLabels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedLabels.length - 3} more
                </span>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">No labels available</p>
        ) : (
          <div className="space-y-1">
            {labels.map((label) => (
              <button
                key={label.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent',
                  selectedIds.includes(label.id) && 'bg-accent'
                )}
                onClick={() => toggleLabel(label.id)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 text-left">{label.name}</span>
                {selectedIds.includes(label.id) && (
                  <Check className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

### LabelFilter

```typescript
// app/(app)/todos/label-filter.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Label = {
  id: string;
  name: string;
  color: string;
};

type LabelFilterProps = {
  labels: Label[];
};

export function LabelFilter({ labels }: LabelFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentLabel = searchParams.get('label') || 'all';

  const handleChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('label');
    } else {
      params.set('label', value);
    }
    params.set('page', '1'); // Reset to first page
    router.push(`/todos?${params.toString()}`);
  };

  return (
    <Select value={currentLabel} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="Label" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All labels</SelectItem>
        {labels.map((label) => (
          <SelectItem key={label.id} value={label.id}>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: label.color }}
              />
              {label.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Label Management Page

```typescript
// app/(app)/settings/labels/page.tsx
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { LabelList } from './label-list';
import { CreateLabelForm } from './create-label-form';

export default async function LabelsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/settings');

  const labels = await prisma.label.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { todos: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Labels</h2>
        <p className="text-muted-foreground">
          Manage labels for categorizing todos.
        </p>
      </div>

      <CreateLabelForm />

      <LabelList labels={labels} />
    </div>
  );
}
```

### Color Picker Component

```typescript
// components/color-picker.tsx
'use client';

import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
];

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESET_COLORS.map((color) => (
        <button
          key={color.value}
          type="button"
          className={cn(
            'w-8 h-8 rounded-full border-2 transition-all',
            value === color.value
              ? 'border-foreground scale-110'
              : 'border-transparent hover:scale-105'
          )}
          style={{ backgroundColor: color.value }}
          onClick={() => onChange(color.value)}
          title={color.name}
        />
      ))}
    </div>
  );
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Tags as free-text (no Label model) | Simpler, no admin management | Inconsistent naming, no colors, harder to filter | Labels need consistency and visual distinction |
| Labels in JSON field on Todo | No join table needed | Harder to query, no referential integrity | SQLite JSON support is limited; proper relations are better |
| Pre-defined label sets | Easier onboarding | Less flexible | Teams have different workflows; empty start is fine |
| Multiple label filter (AND/OR) | More powerful filtering | Complex UI, complex queries | Single filter sufficient for MVP |

---

## Security Considerations

- **Authorization**: createLabel, updateLabel, deleteLabel verify admin role
- **Tenant isolation**: All label operations verify tenant ownership
- **Input validation**: Label name length, color format validated
- **XSS prevention**: Label names rendered as text, colors validated as hex

---

## Testing Strategy

**Unit Tests**
- createLabel action: admin check, duplicate name validation, color format validation
- updateLabel action: admin check, tenant verification, duplicate name check
- deleteLabel action: admin check, tenant verification
- updateTodoLabels action: tenant verification, label validation
- LabelBadge: renders with correct colors and contrast text

**E2E Tests**
- Admin can create a new label with name and color
- Admin can edit existing label
- Admin can delete label (removes from todos)
- Non-admin cannot access label management
- User can apply labels to todo
- User can remove labels from todo
- Labels display on todo cards
- Filter by label works correctly
- Label filter persists in URL

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add Label and TodoLabel models to Prisma schema**
   - Add Label model with tenant relationship
   - Add TodoLabel join table
   - Update Todo and Tenant models with label relations
   - Run migration
   - Depends on: None

2. **feat(api): add label management server actions**
   - Implement createLabel with admin check and validation
   - Implement updateLabel with admin check
   - Implement deleteLabel with admin check
   - Add unit tests for all actions
   - Depends on: #1

3. **feat(api): add updateTodoLabels server action**
   - Implement updateTodoLabels for setting labels on todos
   - Add tenant and label validation
   - Add unit tests
   - Depends on: #1

4. **feat(ui): add LabelBadge component**
   - Create LabelBadge with dynamic contrast text
   - Add ColorPicker component for label forms
   - Depends on: None

5. **feat(ui): add label management page for admins**
   - Create /settings/labels page
   - Add CreateLabelForm with color picker
   - Add LabelList with edit/delete functionality
   - Add admin-only access check
   - Depends on: #2, #4

6. **feat(ui): add label display to todo cards**
   - Update todo query to include labels
   - Display label badges on todo cards
   - Handle overflow (3+ labels shows "+N more")
   - Depends on: #1, #4

7. **feat(ui): add LabelSelector to todo create/edit forms**
   - Create LabelSelector multi-select component
   - Integrate into create and edit todo dialogs
   - Wire up updateTodoLabels action
   - Depends on: #3, #4

8. **feat(ui): add label filter to todo list**
   - Create LabelFilter dropdown component
   - Update todo query to filter by label
   - Add label filter to URL state
   - Depends on: #1

9. **test(e2e): add E2E tests for todo labels**
   - Test label management (CRUD)
   - Test applying/removing labels on todos
   - Test label display on cards
   - Test label filtering
   - Test admin-only restrictions
   - Depends on: #5, #6, #7, #8

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Popover, Select, Button, Input)
- Uses existing Prisma patterns for many-to-many relationships
