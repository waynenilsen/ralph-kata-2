ERD: 0014
Title: Todo Subtasks
Author: Engineering
Status: Draft
PRD: [PRD-0014](../prd/0014-todo-subtasks.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding subtasks (checklists) to todos. Users can break down complex tasks into smaller, trackable items. Subtasks are simple checklist items with completion state, displayed inline within the todo edit dialog.

---

## Background

- PRD-0014 defines the product requirements for todo subtasks
- PRD-0001 established the multi-tenant todo system with User and Todo models
- PRD-0011 added comments, establishing the pattern for related lists in the todo dialog
- Subtasks provide a lightweight way to track incremental progress on tasks

---

## Goals and Non-Goals

**Goals:**
- Add Subtask model linked to Todo
- Allow any tenant member to add, edit, delete, and toggle subtasks
- Display subtasks as a checklist in todo edit dialog
- Show subtask progress indicator on todo cards (e.g., "3/5")
- Maintain tenant isolation (subtasks inherit parent todo's tenant)
- Support ordering of subtasks

**Non-Goals:**
- Nested subtasks (only one level)
- Subtask assignees, due dates, or labels
- Converting subtasks to full todos
- Drag-and-drop reordering
- Real-time updates (WebSockets)
- Subtask search

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
│  Todo Card  │────▶│ Edit Dialog │────▶│  Subtasks   │
│  (progress) │     │  + Subtasks │     │   Section   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Server    │
                    │   Actions   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Prisma    │
                    │   Subtask   │
                    └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Subtask model | Stores subtask data with todo relationship |
| createSubtask action | Server action to add a subtask to a todo |
| updateSubtask action | Server action to edit subtask title |
| toggleSubtask action | Server action to toggle completion state |
| deleteSubtask action | Server action to remove a subtask |
| SubtaskSection | Displays subtask checklist and add form |
| SubtaskItem | Renders a single subtask with checkbox and edit/delete |
| Todo card progress | Shows completion indicator (e.g., "3/5") |

**Data Flow**

1. User opens todo edit dialog
2. Dialog fetches todo with subtasks included (via Prisma include)
3. SubtaskSection renders existing subtasks as checklist
4. User can toggle, edit, or delete existing subtasks
5. User can add new subtasks via inline input
6. Server actions validate and save changes
7. Page revalidates, showing updated subtasks

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Subtask model shall have id, title, isComplete, order, todoId, createdAt fields | Must |
| REQ-002 | Subtasks shall be linked to exactly one Todo via foreign key | Must |
| REQ-003 | Deleting a todo shall cascade delete its subtasks | Must |
| REQ-004 | Subtasks shall be ordered by order field ascending | Must |
| REQ-005 | Subtask title shall not be empty (server-side validation) | Must |
| REQ-006 | Subtask title shall have max length of 200 characters | Must |
| REQ-007 | Maximum 20 subtasks per todo (server-side validation) | Must |
| REQ-008 | Todo card shall display progress indicator when subtasks exist | Must |
| REQ-009 | Server actions shall verify user belongs to same tenant as todo | Must |
| REQ-010 | New subtasks should be appended at end (highest order + 1) | Should |
| REQ-011 | Subtasks should load with todo in single query (no N+1) | Should |
| REQ-012 | Completed subtasks should display with strikethrough styling | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/subtasks.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

const MAX_SUBTASKS = 20;
const MAX_TITLE_LENGTH = 200;

export type SubtaskActionState = {
  success?: boolean;
  error?: string;
};

// Verify todo belongs to user's tenant
async function verifyTodoAccess(todoId: string, tenantId: string): Promise<boolean> {
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });
  return todo?.tenantId === tenantId;
}

export async function createSubtask(
  todoId: string,
  _prevState: SubtaskActionState,
  formData: FormData
): Promise<SubtaskActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const title = formData.get('title') as string;
  if (!title?.trim()) {
    return { error: 'Subtask title cannot be empty' };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Subtask title must be ${MAX_TITLE_LENGTH} characters or less` };
  }

  if (!await verifyTodoAccess(todoId, session.user.tenantId)) {
    return { error: 'Todo not found' };
  }

  // Check subtask count limit
  const subtaskCount = await prisma.subtask.count({ where: { todoId } });
  if (subtaskCount >= MAX_SUBTASKS) {
    return { error: `Maximum ${MAX_SUBTASKS} subtasks allowed per todo` };
  }

  // Get next order value
  const lastSubtask = await prisma.subtask.findFirst({
    where: { todoId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (lastSubtask?.order ?? -1) + 1;

  await prisma.subtask.create({
    data: {
      title: title.trim(),
      todoId,
      order: nextOrder,
      isComplete: false,
    },
  });

  revalidatePath('/todos');
  return { success: true };
}

export async function updateSubtask(
  subtaskId: string,
  _prevState: SubtaskActionState,
  formData: FormData
): Promise<SubtaskActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const title = formData.get('title') as string;
  if (!title?.trim()) {
    return { error: 'Subtask title cannot be empty' };
  }

  if (title.length > MAX_TITLE_LENGTH) {
    return { error: `Subtask title must be ${MAX_TITLE_LENGTH} characters or less` };
  }

  // Get subtask and verify access
  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.user.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { title: title.trim() },
  });

  revalidatePath('/todos');
  return { success: true };
}

export async function toggleSubtask(
  subtaskId: string
): Promise<SubtaskActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.user.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { isComplete: !subtask.isComplete },
  });

  revalidatePath('/todos');
  return { success: true };
}

export async function deleteSubtask(
  subtaskId: string
): Promise<SubtaskActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const subtask = await prisma.subtask.findUnique({
    where: { id: subtaskId },
    include: { todo: { select: { tenantId: true } } },
  });

  if (!subtask || subtask.todo.tenantId !== session.user.tenantId) {
    return { error: 'Subtask not found' };
  }

  await prisma.subtask.delete({
    where: { id: subtaskId },
  });

  revalidatePath('/todos');
  return { success: true };
}
```

### Data Fetching

Extend existing todo queries to include subtasks:

```typescript
// When fetching a single todo for edit dialog
const todo = await prisma.todo.findUnique({
  where: { id: todoId },
  include: {
    assignee: true,
    createdBy: true,
    comments: {
      include: { author: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    },
    labels: { include: { label: true } },
    subtasks: {
      orderBy: { order: 'asc' },
    },
  },
});
```

For todo list (card display), use count aggregation:

```typescript
// When fetching todos for list
const todos = await prisma.todo.findMany({
  where: { tenantId },
  include: {
    assignee: true,
    createdBy: true,
    labels: { include: { label: true } },
    _count: {
      select: { comments: true, subtasks: true },
    },
    subtasks: {
      select: { isComplete: true },
    },
  },
});

// Calculate progress for each todo
todos.map(todo => ({
  ...todo,
  subtaskProgress: {
    completed: todo.subtasks.filter(s => s.isComplete).length,
    total: todo.subtasks.length,
  },
}));
```

---

## Data Model

### New Prisma Schema

```prisma
// prisma/subtask.prisma
model Subtask {
  id         String   @id @default(cuid())
  title      String
  isComplete Boolean  @default(false)
  order      Int      @default(0)
  todo       Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  todoId     String
  createdAt  DateTime @default(now())

  @@index([todoId])
}
```

### Model Updates

```prisma
// prisma/todo.prisma - add relation
model Todo {
  // ... existing fields ...
  subtasks Subtask[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### SubtaskSection

```typescript
// app/(app)/todos/subtask-section.tsx
'use client';

import { useActionState, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { createSubtask, SubtaskActionState } from '@/app/actions/subtasks';
import { SubtaskItem } from './subtask-item';

type Subtask = {
  id: string;
  title: string;
  isComplete: boolean;
  order: number;
};

type SubtaskSectionProps = {
  todoId: string;
  subtasks: Subtask[];
};

export function SubtaskSection({ todoId, subtasks }: SubtaskSectionProps) {
  const [state, formAction, isPending] = useActionState(
    createSubtask.bind(null, todoId),
    {}
  );
  const formRef = useRef<HTMLFormElement>(null);
  const completedCount = subtasks.filter(s => s.isComplete).length;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">
        Subtasks {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
      </h4>

      {subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subtasks</p>
      ) : (
        <div className="space-y-1">
          {subtasks.map((subtask) => (
            <SubtaskItem key={subtask.id} subtask={subtask} />
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="flex items-center gap-2"
      >
        <Input
          name="title"
          placeholder="Add subtask..."
          className="h-8 text-sm"
          maxLength={200}
        />
        <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </div>
  );
}
```

### SubtaskItem

```typescript
// app/(app)/todos/subtask-item.tsx
'use client';

import { useState, useTransition } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';
import { toggleSubtask, updateSubtask, deleteSubtask } from '@/app/actions/subtasks';
import { cn } from '@/lib/utils';

type SubtaskItemProps = {
  subtask: {
    id: string;
    title: string;
    isComplete: boolean;
  };
};

export function SubtaskItem({ subtask }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleSubtask(subtask.id);
    });
  };

  const handleSave = () => {
    if (!editTitle.trim()) return;
    const formData = new FormData();
    formData.set('title', editTitle);
    startTransition(async () => {
      await updateSubtask(subtask.id, {}, formData);
      setIsEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteSubtask(subtask.id);
    });
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="h-7 text-sm flex-1"
          maxLength={200}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
          }}
        />
        <Button size="sm" variant="ghost" onClick={handleSave} disabled={isPending}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <Checkbox
        checked={subtask.isComplete}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <span
        className={cn(
          'flex-1 text-sm cursor-pointer',
          subtask.isComplete && 'line-through text-muted-foreground'
        )}
        onClick={() => setIsEditing(true)}
      >
        {subtask.title}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
        onClick={handleDelete}
        disabled={isPending}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
```

### Todo Card Progress Indicator

Add to existing TodoCard component:

```typescript
// In todo-card.tsx, add subtask progress display
{todo.subtasks.length > 0 && (
  <div className="flex items-center gap-1 text-muted-foreground text-xs">
    <CheckSquare className="h-3 w-3" />
    <span>
      {todo.subtasks.filter(s => s.isComplete).length}/{todo.subtasks.length}
    </span>
  </div>
)}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Subtasks as separate todos | Reuse existing todo model | Loses parent-child relationship, clutters list | Explicit hierarchy is clearer |
| Markdown checklists in description | Zero schema changes | No structured data, can't track completion | Poor UX, no progress tracking |
| Nested subtasks | More flexibility | Significantly more complex UI and data model | One level is sufficient for MVP |
| Drag-and-drop reorder | Better UX for ordering | Adds library dependency and complexity | Add at bottom is sufficient |

---

## Security Considerations

- **Authorization**: All actions verify user's tenant matches todo's tenant
- **Input validation**: Title trimmed, checked for empty, length limited
- **XSS prevention**: Title rendered as text, not HTML
- **Cascade delete**: Subtasks deleted when parent todo is deleted

---

## Testing Strategy

**Unit Tests**
- createSubtask: authentication, empty title, length validation, tenant verification, max limit
- updateSubtask: authentication, empty title, tenant verification
- toggleSubtask: authentication, tenant verification, toggle logic
- deleteSubtask: authentication, tenant verification
- SubtaskSection: renders subtasks, shows empty state, handles form submission
- SubtaskItem: renders checkbox, toggle works, edit mode, delete works

**E2E Tests**
- User can add subtask to todo
- User can toggle subtask completion
- User can edit subtask title
- User can delete subtask
- Subtask progress shows on todo card
- Maximum 20 subtasks enforced
- Subtasks persist across page reload
- User cannot modify subtasks on todo from another tenant

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add Subtask model to Prisma schema**
   - Add Subtask model with fields: id, title, isComplete, order, todoId, createdAt
   - Update Todo model with subtasks relation
   - Run migration
   - Depends on: None

2. **feat(api): add subtask server actions**
   - Implement createSubtask with validation and max limit check
   - Implement updateSubtask with validation
   - Implement toggleSubtask
   - Implement deleteSubtask
   - Add tenant authorization checks to all actions
   - Add unit tests
   - Depends on: #1

3. **feat(ui): add subtask progress to todo cards**
   - Update todo query to include subtasks (isComplete field)
   - Add CheckSquare icon with progress count (e.g., "3/5")
   - Only show when todo has subtasks
   - Depends on: #1

4. **feat(ui): add SubtaskSection to edit todo dialog**
   - Create SubtaskItem component with checkbox, edit, delete
   - Create SubtaskSection component with list and add form
   - Integrate into EditTodoForm dialog
   - Update todo fetch to include subtasks ordered by order
   - Depends on: #2, #3

5. **test(e2e): add E2E tests for todo subtasks**
   - Test adding subtask
   - Test toggling subtask
   - Test editing subtask
   - Test deleting subtask
   - Test progress display on card
   - Test max subtask limit
   - Test tenant isolation
   - Depends on: #4

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Checkbox, Input, Button)
- Uses lucide-react icons (Plus, X, Check, CheckSquare)
