ERD: 0018
Title: Todo Archives
Author: Engineering
Status: Draft
PRD: [PRD-0018](../prd/0018-todo-archives.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding archive and trash functionality to todos. Users can archive completed todos to remove them from the main view, and deleted todos go to trash for potential recovery before permanent deletion.

---

## Background

- PRD-0018 defines the product requirements for todo archives and trash
- PRD-0001 established the multi-tenant todo system
- PRD-0014 added subtasks which should follow parent todo to archive/trash
- PRD-0017 added activity logs which will track archive/restore actions
- Users need a way to clean up completed work without losing history

---

## Goals and Non-Goals

**Goals:**
- Add archivedAt and deletedAt timestamp fields to Todo model
- Archive action removes todo from main view, preserves in archive view
- Soft delete moves todo to trash instead of permanent deletion
- Restore actions return todos to active state
- Permanent delete removes todo from database entirely
- Activity log entries for archive/restore actions
- Archive and trash views accessible from navigation

**Non-Goals:**
- Automatic archival rules (time-based archiving)
- Bulk archive/restore operations
- Archive search or filtering (use existing search)
- Archive export
- Auto-cleanup of trash items
- Archive/trash counts in navigation

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
│  Archive    │────▶│  Set        │────▶│   Todo      │
│  Action     │     │ archivedAt  │     │   Table     │
└─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Delete     │────▶│  Set        │────▶│   Todo      │
│  Action     │     │ deletedAt   │     │   Table     │
└─────────────┘     └─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Main List  │────▶│ WHERE NULL  │────▶│ Active Todos│
│   Query     │     │ archivedAt  │     │             │
│             │     │ AND NULL    │     │             │
│             │     │ deletedAt   │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Todo model fields | archivedAt, deletedAt timestamps |
| archiveTodo action | Sets archivedAt, creates activity |
| unarchiveTodo action | Clears archivedAt, creates activity |
| softDeleteTodo action | Sets deletedAt, creates activity |
| restoreFromTrash action | Clears deletedAt, creates activity |
| permanentDeleteTodo action | Removes todo from database |
| ArchivePage | Archive view with todo list |
| TrashPage | Trash view with restore/delete options |
| Navigation links | Links to archive and trash views |

**Data Flow**

1. User archives a todo:
   a. archiveTodo action sets archivedAt to now()
   b. Activity entry created with action ARCHIVED
   c. Todo no longer appears in main list
   d. Todo appears in archive view
2. User restores from archive:
   a. unarchiveTodo action clears archivedAt
   b. Activity entry created with action UNARCHIVED
   c. Todo reappears in main list
3. User deletes a todo:
   a. softDeleteTodo action sets deletedAt to now()
   b. Activity entry created with action TRASHED
   c. Todo disappears from main/archive views
   d. Todo appears in trash view
4. User restores from trash:
   a. restoreFromTrash action clears deletedAt
   b. Activity entry created with action RESTORED
   c. Todo returns to previous state (archive or main)
5. User permanently deletes:
   a. permanentDeleteTodo action deletes todo record
   b. Cascade deletes subtasks, comments, labels, activities
   c. Todo is gone forever

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Todo model shall have archivedAt (DateTime, nullable) field | Must |
| REQ-002 | Todo model shall have deletedAt (DateTime, nullable) field | Must |
| REQ-003 | Main todo list shall exclude todos where archivedAt IS NOT NULL | Must |
| REQ-004 | Main todo list shall exclude todos where deletedAt IS NOT NULL | Must |
| REQ-005 | Archive view shall show todos where archivedAt IS NOT NULL AND deletedAt IS NULL | Must |
| REQ-006 | Trash view shall show todos where deletedAt IS NOT NULL | Must |
| REQ-007 | archiveTodo action shall set archivedAt to current timestamp | Must |
| REQ-008 | unarchiveTodo action shall clear archivedAt (set to null) | Must |
| REQ-009 | softDeleteTodo action shall set deletedAt to current timestamp | Must |
| REQ-010 | restoreFromTrash action shall clear deletedAt (set to null) | Must |
| REQ-011 | permanentDeleteTodo action shall remove todo from database | Must |
| REQ-012 | Archive/restore actions shall create activity log entries | Must |
| REQ-013 | Navigation shall include links to archive and trash views | Must |
| REQ-014 | Permanent delete shall require confirmation dialog | Must |
| REQ-015 | Subtasks shall follow parent todo to archive/trash (inherited via parent query) | Should |
| REQ-016 | Search shall include archived todos (not trashed) | Should |
| REQ-017 | Todo table shall be indexed on (tenantId, archivedAt, deletedAt) | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/archive.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createTodoActivity } from './activities';

export type ArchiveActionState = {
  success?: boolean;
  error?: string;
};

// Archive a todo
export async function archiveTodo(todoId: string): Promise<ArchiveActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, archivedAt: true, deletedAt: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  if (todo.deletedAt) {
    return { error: 'Cannot archive a deleted todo' };
  }

  if (todo.archivedAt) {
    return { error: 'Todo is already archived' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { archivedAt: new Date() },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'ARCHIVED',
  });

  revalidatePath('/todos');
  revalidatePath('/archive');
  return { success: true };
}

// Restore from archive
export async function unarchiveTodo(todoId: string): Promise<ArchiveActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, archivedAt: true, deletedAt: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  if (todo.deletedAt) {
    return { error: 'Cannot unarchive a deleted todo' };
  }

  if (!todo.archivedAt) {
    return { error: 'Todo is not archived' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { archivedAt: null },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'UNARCHIVED',
  });

  revalidatePath('/todos');
  revalidatePath('/archive');
  return { success: true };
}

// Soft delete (move to trash)
export async function softDeleteTodo(todoId: string): Promise<ArchiveActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, deletedAt: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  if (todo.deletedAt) {
    return { error: 'Todo is already in trash' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { deletedAt: new Date() },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'TRASHED',
  });

  revalidatePath('/todos');
  revalidatePath('/archive');
  revalidatePath('/trash');
  return { success: true };
}

// Restore from trash
export async function restoreFromTrash(todoId: string): Promise<ArchiveActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, deletedAt: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  if (!todo.deletedAt) {
    return { error: 'Todo is not in trash' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { deletedAt: null },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'RESTORED',
  });

  revalidatePath('/todos');
  revalidatePath('/archive');
  revalidatePath('/trash');
  return { success: true };
}

// Permanent delete
export async function permanentDeleteTodo(todoId: string): Promise<ArchiveActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, deletedAt: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  // Only allow permanent delete from trash
  if (!todo.deletedAt) {
    return { error: 'Todo must be in trash to permanently delete' };
  }

  // This cascades to subtasks, comments, labels, activities
  await prisma.todo.delete({
    where: { id: todoId },
  });

  revalidatePath('/trash');
  return { success: true };
}
```

### Query Modifications

```typescript
// app/actions/todos.ts - modify getTodos to exclude archived and deleted

export async function getTodos(options?: GetTodosOptions): Promise<{
  todos: Todo[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { todos: [], error: 'Not authenticated' };
  }

  const todos = await prisma.todo.findMany({
    where: {
      tenantId: session.user.tenantId,
      archivedAt: null,  // Exclude archived
      deletedAt: null,   // Exclude deleted
      // ... other filters
    },
    // ... rest of query
  });

  return { todos };
}

// New action for archive view
export async function getArchivedTodos(): Promise<{
  todos: Todo[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { todos: [], error: 'Not authenticated' };
  }

  const todos = await prisma.todo.findMany({
    where: {
      tenantId: session.user.tenantId,
      archivedAt: { not: null },  // Only archived
      deletedAt: null,            // Not deleted
    },
    orderBy: { archivedAt: 'desc' },
    include: {
      labels: { include: { label: true } },
      assignee: { select: { id: true, email: true } },
      _count: { select: { subtasks: true, comments: true } },
    },
  });

  return { todos };
}

// New action for trash view
export async function getTrashedTodos(): Promise<{
  todos: Todo[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { todos: [], error: 'Not authenticated' };
  }

  const todos = await prisma.todo.findMany({
    where: {
      tenantId: session.user.tenantId,
      deletedAt: { not: null },  // Only deleted
    },
    orderBy: { deletedAt: 'desc' },
    include: {
      labels: { include: { label: true } },
      assignee: { select: { id: true, email: true } },
      _count: { select: { subtasks: true, comments: true } },
    },
  });

  return { todos };
}
```

---

## Data Model

### Todo Model Updates

```prisma
// prisma/todo.prisma
model Todo {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TodoStatus @default(PENDING)
  dueDate     DateTime?
  archivedAt  DateTime?  // NEW: null = active, set = archived
  deletedAt   DateTime?  // NEW: null = not deleted, set = in trash
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  tenantId    String
  createdBy   User       @relation("CreatedTodos", fields: [createdById], references: [id])
  createdById String
  assignee    User?      @relation("AssignedTodos", fields: [assigneeId], references: [id])
  assigneeId  String?
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt
  dueSoonReminderSentAt   DateTime?
  overdueReminderSentAt   DateTime?
  comments                Comment[]
  labels                  TodoLabel[]
  subtasks                Subtask[]

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, dueDate])
  @@index([tenantId, createdAt])
  @@index([tenantId, assigneeId])
  @@index([tenantId, archivedAt])              // NEW
  @@index([tenantId, deletedAt])               // NEW
  @@index([tenantId, archivedAt, deletedAt])   // NEW: for filtering active todos
  @@index([dueDate, status, dueSoonReminderSentAt])
  @@index([dueDate, status, overdueReminderSentAt])
}
```

### Activity Action Enum Update

```prisma
// prisma/schema.prisma - update enum
enum ActivityAction {
  CREATED
  STATUS_CHANGED
  ASSIGNEE_CHANGED
  DUE_DATE_CHANGED
  LABELS_CHANGED
  DESCRIPTION_CHANGED
  ARCHIVED            // NEW
  UNARCHIVED          // NEW
  TRASHED             // NEW
  RESTORED            // NEW
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### Archive Page

```typescript
// app/(app)/archive/page.tsx
import { getArchivedTodos } from '@/app/actions/todos';
import { ArchiveTodoList } from '@/app/components/archive-todo-list';

export default async function ArchivePage() {
  const { todos, error } = await getArchivedTodos();

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Archive</h1>
      {todos.length === 0 ? (
        <p className="text-muted-foreground">No archived todos</p>
      ) : (
        <ArchiveTodoList todos={todos} />
      )}
    </div>
  );
}
```

### Trash Page

```typescript
// app/(app)/trash/page.tsx
import { getTrashedTodos } from '@/app/actions/todos';
import { TrashTodoList } from '@/app/components/trash-todo-list';

export default async function TrashPage() {
  const { todos, error } = await getTrashedTodos();

  if (error) {
    return <div className="text-destructive">{error}</div>;
  }

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-6">Trash</h1>
      {todos.length === 0 ? (
        <p className="text-muted-foreground">Trash is empty</p>
      ) : (
        <TrashTodoList todos={todos} />
      )}
    </div>
  );
}
```

### Archive Todo List

```typescript
// app/components/archive-todo-list.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { unarchiveTodo, softDeleteTodo } from '@/app/actions/archive';
import { Todo } from '@/app/actions/todos';

type ArchiveTodoListProps = {
  todos: Todo[];
};

export function ArchiveTodoList({ todos }: ArchiveTodoListProps) {
  const handleRestore = async (todoId: string) => {
    await unarchiveTodo(todoId);
  };

  const handleDelete = async (todoId: string) => {
    await softDeleteTodo(todoId);
  };

  return (
    <div className="space-y-3">
      {todos.map((todo) => (
        <Card key={todo.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium">{todo.title}</h3>
                {todo.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {todo.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Archived {formatDistanceToNow(new Date(todo.archivedAt!), { addSuffix: true })}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(todo.id)}
                  title="Restore"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(todo.id)}
                  title="Move to trash"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Trash Todo List

```typescript
// app/components/trash-todo-list.tsx
'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { restoreFromTrash, permanentDeleteTodo } from '@/app/actions/archive';
import { Todo } from '@/app/actions/todos';

type TrashTodoListProps = {
  todos: Todo[];
};

export function TrashTodoList({ todos }: TrashTodoListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null);

  const handleRestore = async (todoId: string) => {
    await restoreFromTrash(todoId);
  };

  const handlePermanentDelete = (todoId: string) => {
    setTodoToDelete(todoId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (todoToDelete) {
      await permanentDeleteTodo(todoToDelete);
      setTodoToDelete(null);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {todos.map((todo) => (
          <Card key={todo.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium">{todo.title}</h3>
                  {todo.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {todo.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Deleted {formatDistanceToNow(new Date(todo.deletedAt!), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(todo.id)}
                    title="Restore"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePermanentDelete(todo.id)}
                    title="Delete permanently"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete todo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This todo will be permanently deleted
              and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Todo Card Archive Action

```typescript
// Add to existing todo card dropdown menu
import { Archive } from 'lucide-react';
import { archiveTodo } from '@/app/actions/archive';

// In the dropdown menu items:
<DropdownMenuItem onClick={() => archiveTodo(todo.id)}>
  <Archive className="h-4 w-4 mr-2" />
  Archive
</DropdownMenuItem>
```

### Navigation Updates

```typescript
// Add to sidebar navigation
import { Archive, Trash2 } from 'lucide-react';

// In navigation items:
<NavLink href="/archive" icon={Archive}>
  Archive
</NavLink>
<NavLink href="/trash" icon={Trash2}>
  Trash
</NavLink>
```

---

## Activity Message Formatting

| Action | Message Format | Example |
|--------|----------------|---------|
| ARCHIVED | "{actor} archived this todo" | "alice archived this todo" |
| UNARCHIVED | "{actor} restored this todo from archive" | "alice restored this todo from archive" |
| TRASHED | "{actor} moved this todo to trash" | "alice moved this todo to trash" |
| RESTORED | "{actor} restored this todo from trash" | "alice restored this todo from trash" |

Update ActivityItem to handle new action types:

```typescript
// In getActivityMessage function
case 'ARCHIVED':
  return `${actor} archived this todo`;
case 'UNARCHIVED':
  return `${actor} restored this todo from archive`;
case 'TRASHED':
  return `${actor} moved this todo to trash`;
case 'RESTORED':
  return `${actor} restored this todo from trash`;
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Separate Archive table | Clean separation | Data duplication, complex joins | Single table with timestamps simpler |
| Boolean isArchived flag | Simple | Can't track when archived | Timestamp provides history |
| Immediate permanent delete | Simple | No recovery | Users expect trash functionality |
| Status enum for archive state | Single field | Conflicts with PENDING/COMPLETED | Separate concern from task status |

---

## Security Considerations

- **Authorization**: All actions verify todo belongs to user's tenant
- **Soft delete by default**: Prevents accidental data loss
- **Permanent delete requires explicit action**: Extra step for destructive operation
- **Confirmation dialog**: Prevents accidental permanent deletion
- **Cascade delete**: Subtasks, comments, labels, activities deleted with parent

---

## Testing Strategy

**Unit Tests**
- archiveTodo: sets archivedAt, creates activity
- archiveTodo: fails for deleted todo
- archiveTodo: fails for already archived todo
- unarchiveTodo: clears archivedAt, creates activity
- unarchiveTodo: fails for non-archived todo
- softDeleteTodo: sets deletedAt, creates activity
- softDeleteTodo: fails for already deleted todo
- restoreFromTrash: clears deletedAt, creates activity
- restoreFromTrash: fails for non-deleted todo
- permanentDeleteTodo: removes todo from database
- permanentDeleteTodo: fails for todo not in trash
- getTodos: excludes archived todos
- getTodos: excludes deleted todos
- getArchivedTodos: returns only archived, non-deleted todos
- getTrashedTodos: returns only deleted todos

**E2E Tests**
- Archiving todo removes it from main list
- Archiving todo shows it in archive view
- Restoring from archive returns todo to main list
- Deleting todo removes it from main list
- Deleting todo shows it in trash view
- Restoring from trash returns todo to appropriate view
- Permanent delete removes todo from trash
- Permanent delete shows confirmation dialog
- Archive action creates activity log entry
- Restore action creates activity log entry
- Delete action creates activity log entry
- Navigation includes archive and trash links
- Archive view shows empty state when empty
- Trash view shows empty state when empty

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add archivedAt and deletedAt fields to Todo model**
   - Add archivedAt DateTime nullable field
   - Add deletedAt DateTime nullable field
   - Add indexes for efficient querying
   - Run migration
   - Depends on: None

2. **feat(db): add archive activity actions to ActivityAction enum**
   - Add ARCHIVED, UNARCHIVED, TRASHED, RESTORED to ActivityAction enum
   - Run migration
   - Depends on: #1

3. **feat(api): add archiveTodo server action**
   - Implement archiveTodo action
   - Set archivedAt to current timestamp
   - Create ARCHIVED activity entry
   - Validate tenant authorization
   - Handle edge cases (already archived, deleted)
   - Add unit tests
   - Depends on: #2

4. **feat(api): add unarchiveTodo server action**
   - Implement unarchiveTodo action
   - Clear archivedAt
   - Create UNARCHIVED activity entry
   - Validate tenant authorization
   - Handle edge cases (not archived, deleted)
   - Add unit tests
   - Depends on: #2

5. **feat(api): add softDeleteTodo server action**
   - Implement softDeleteTodo action
   - Set deletedAt to current timestamp
   - Create TRASHED activity entry
   - Validate tenant authorization
   - Handle edge cases (already deleted)
   - Add unit tests
   - Depends on: #2

6. **feat(api): add restoreFromTrash server action**
   - Implement restoreFromTrash action
   - Clear deletedAt
   - Create RESTORED activity entry
   - Validate tenant authorization
   - Handle edge cases (not in trash)
   - Add unit tests
   - Depends on: #2

7. **feat(api): add permanentDeleteTodo server action**
   - Implement permanentDeleteTodo action
   - Delete todo from database (cascade)
   - Only allow from trash
   - Validate tenant authorization
   - Add unit tests
   - Depends on: #5

8. **feat(api): update getTodos to exclude archived and deleted todos**
   - Add archivedAt: null filter
   - Add deletedAt: null filter
   - Add unit tests
   - Depends on: #1

9. **feat(api): add getArchivedTodos server action**
   - Query todos with archivedAt not null, deletedAt null
   - Order by archivedAt descending
   - Include labels, assignee, counts
   - Add unit tests
   - Depends on: #1

10. **feat(api): add getTrashedTodos server action**
    - Query todos with deletedAt not null
    - Order by deletedAt descending
    - Include labels, assignee, counts
    - Add unit tests
    - Depends on: #1

11. **feat(ui): add archive action to todo card dropdown**
    - Add Archive option to todo card dropdown menu
    - Use Archive icon from lucide-react
    - Call archiveTodo action on click
    - Depends on: #3

12. **feat(ui): add ArchiveTodoList component**
    - Display archived todos with title, description, archive date
    - Show restore and delete buttons
    - Use Card component from shadcn/ui
    - Format dates with date-fns
    - Depends on: #4, #5

13. **feat(ui): add archive page**
    - Create /archive route
    - Fetch archived todos with getArchivedTodos
    - Display ArchiveTodoList
    - Show empty state when no archived todos
    - Depends on: #9, #12

14. **feat(ui): add TrashTodoList component**
    - Display trashed todos with title, description, delete date
    - Show restore and permanent delete buttons
    - Add confirmation dialog for permanent delete
    - Use AlertDialog from shadcn/ui
    - Depends on: #6, #7

15. **feat(ui): add trash page**
    - Create /trash route
    - Fetch trashed todos with getTrashedTodos
    - Display TrashTodoList
    - Show empty state when trash is empty
    - Depends on: #10, #14

16. **feat(ui): add archive and trash links to navigation**
    - Add Archive link with Archive icon
    - Add Trash link with Trash2 icon
    - Position appropriately in sidebar
    - Depends on: #13, #15

17. **feat(ui): update ActivityItem for archive actions**
    - Add message formatting for ARCHIVED action
    - Add message formatting for UNARCHIVED action
    - Add message formatting for TRASHED action
    - Add message formatting for RESTORED action
    - Depends on: #2

18. **test(e2e): add E2E tests for archive functionality**
    - Test archiving removes todo from main list
    - Test archive view shows archived todos
    - Test restore from archive returns to main list
    - Test archive creates activity entry
    - Depends on: #13, #17

19. **test(e2e): add E2E tests for trash functionality**
    - Test delete moves todo to trash
    - Test trash view shows deleted todos
    - Test restore from trash returns todo
    - Test permanent delete removes todo
    - Test permanent delete shows confirmation
    - Test delete/restore creates activity entries
    - Depends on: #15, #17

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Card, Button, AlertDialog, DropdownMenu)
- Uses lucide-react icons (Archive, Trash2, RotateCcw)
- Uses date-fns for relative time formatting (formatDistanceToNow)
