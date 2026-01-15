ERD: 0020
Title: Todo Bulk Operations
Author: Engineering
Status: Draft
PRD: [PRD-0020](../prd/0020-todo-bulk-operations.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for todo bulk operations. Users can select multiple todos in the list view and perform batch actions including mark complete, mark pending, archive, delete, assign, unassign, add label, and remove label.

---

## Background

- PRD-0020 defines the product requirements for bulk operations
- PRD-0001 established the multi-tenant todo system
- PRD-0010 added assignees for bulk assignment
- PRD-0012 added labels for bulk labeling
- PRD-0017 added activity log for tracking bulk changes
- PRD-0018 added archives for bulk archiving
- Users managing many todos need efficient batch operations

---

## Goals and Non-Goals

**Goals:**
- Add selection mode to todo list
- Add selection checkbox to todo cards
- Add select all/clear selection controls
- Add floating action bar with bulk actions
- Implement bulk server actions for all operations
- Record activity entries for bulk operations
- Create notifications for bulk assignments
- Maintain tenant isolation in all bulk operations

**Non-Goals:**
- Bulk edit of titles or descriptions
- Bulk creation of todos
- Undo functionality
- Keyboard-only selection
- Selection across pages
- Saved bulk operation presets

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
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Selection UI   │────▶│  Bulk Action    │────▶│   Database      │
│  (Client State) │     │  Server Action  │     │   (SQLite)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                              │                         │
                    ┌─────────┴─────────┐               │
                    │                   │               │
              ┌─────▼─────┐       ┌─────▼─────┐   ┌─────▼─────┐
              │  Activity │       │ Notif.    │   │   Todos   │
              │  Entries  │       │ (Assign)  │   │  Updated  │
              └───────────┘       └───────────┘   └───────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| SelectionProvider | React context for selection state management |
| useSelection hook | Access and manipulate selection state |
| TodoCard (selection mode) | Render checkbox and highlight state |
| SelectionControls | Select all, clear, cancel buttons |
| BulkActionBar | Floating bar with bulk action buttons |
| AssignPopover | User selection for bulk assign |
| LabelPopover | Label selection for bulk add/remove |
| bulkUpdateStatus action | Bulk complete/pending server action |
| bulkArchive action | Bulk archive server action |
| bulkDelete action | Bulk soft delete server action |
| bulkAssign action | Bulk assign server action |
| bulkUnassign action | Bulk unassign server action |
| bulkAddLabel action | Bulk add label server action |
| bulkRemoveLabel action | Bulk remove label server action |

**Data Flow**

1. User enters selection mode:
   a. Click "Select" button in header
   b. Selection mode state activates
   c. Todo cards render checkboxes

2. User selects todos:
   a. Click checkbox on todo card
   b. Todo ID added to selection set
   c. Selection count updates
   d. Action bar appears (1+ selected)

3. User performs bulk action:
   a. Click action in floating bar
   b. Server action receives array of todo IDs
   c. Validates all todos belong to tenant
   d. Updates todos in single transaction
   e. Creates activity entries in batch
   f. Creates notifications if applicable
   g. Returns success/error
   h. UI updates (selection may clear)

4. User exits selection mode:
   a. Click "Cancel" button
   b. Selection clears
   c. Selection mode deactivates
   d. Todo cards hide checkboxes

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Selection state shall be managed client-side in React context | Must |
| REQ-002 | Todo cards shall show checkbox in selection mode | Must |
| REQ-003 | Selection controls shall include select all, clear, cancel | Must |
| REQ-004 | Action bar shall be visible when 1+ todos selected | Must |
| REQ-005 | Bulk actions shall validate tenant ownership for all todos | Must |
| REQ-006 | Bulk actions shall execute in a single transaction | Must |
| REQ-007 | bulkUpdateStatus shall set status for all selected todos | Must |
| REQ-008 | bulkArchive shall set archivedAt for all selected todos | Must |
| REQ-009 | bulkDelete shall set deletedAt for all selected todos | Must |
| REQ-010 | bulkAssign shall set assigneeId for all selected todos | Must |
| REQ-011 | bulkUnassign shall clear assigneeId for all selected todos | Must |
| REQ-012 | bulkAddLabel shall create TodoLabel records for selected todos | Must |
| REQ-013 | bulkRemoveLabel shall delete TodoLabel records for selected todos | Must |
| REQ-014 | Activity entries shall be created for each affected todo | Must |
| REQ-015 | Notifications shall be created for bulk assignments (not self) | Should |
| REQ-016 | Selection shall clear after archive and delete actions | Should |
| REQ-017 | Selection shall persist after status, assign, label actions | Should |
| REQ-018 | Action bar shall be fixed at bottom of viewport | Should |
| REQ-019 | Delete action shall require confirmation dialog | Should |
| REQ-020 | Selection count shall be displayed in header and action bar | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/bulk.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type BulkActionResult = {
  success?: boolean;
  error?: string;
  affectedCount?: number;
};

// Validate that all todo IDs belong to the user's tenant
async function validateTodoOwnership(
  todoIds: string[],
  tenantId: string
): Promise<boolean> {
  const count = await prisma.todo.count({
    where: {
      id: { in: todoIds },
      tenantId,
      deletedAt: null,
    },
  });
  return count === todoIds.length;
}

// Bulk update status (complete or pending)
export async function bulkUpdateStatus(
  todoIds: string[],
  status: 'COMPLETED' | 'PENDING'
): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Get current status of each todo to avoid no-op activity entries
  const currentTodos = await prisma.todo.findMany({
    where: { id: { in: todoIds } },
    select: { id: true, status: true },
  });

  const todosToUpdate = currentTodos.filter((t) => t.status !== status);

  if (todosToUpdate.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToUpdateIds = todosToUpdate.map((t) => t.id);

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { id: { in: todosToUpdateIds } },
      data: { status },
    }),
    prisma.todoActivity.createMany({
      data: todosToUpdateIds.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'STATUS_CHANGED',
        field: 'status',
        oldValue: currentTodos.find((t) => t.id === todoId)?.status,
        newValue: status,
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToUpdate.length };
}

// Bulk archive
export async function bulkArchive(todoIds: string[]): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Only archive todos not already archived
  const todosToArchive = await prisma.todo.findMany({
    where: {
      id: { in: todoIds },
      archivedAt: null,
    },
    select: { id: true },
  });

  if (todosToArchive.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToArchiveIds = todosToArchive.map((t) => t.id);
  const now = new Date();

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { id: { in: todosToArchiveIds } },
      data: { archivedAt: now },
    }),
    prisma.todoActivity.createMany({
      data: todosToArchiveIds.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'ARCHIVED',
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToArchive.length };
}

// Bulk soft delete (move to trash)
export async function bulkDelete(todoIds: string[]): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Only delete todos not already deleted
  const todosToDelete = await prisma.todo.findMany({
    where: {
      id: { in: todoIds },
      deletedAt: null,
    },
    select: { id: true },
  });

  if (todosToDelete.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToDeleteIds = todosToDelete.map((t) => t.id);
  const now = new Date();

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { id: { in: todosToDeleteIds } },
      data: { deletedAt: now },
    }),
    prisma.todoActivity.createMany({
      data: todosToDeleteIds.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'TRASHED',
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToDelete.length };
}

// Bulk assign
export async function bulkAssign(
  todoIds: string[],
  assigneeId: string
): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Validate assignee belongs to tenant
  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { tenantId: true },
  });

  if (!assignee || assignee.tenantId !== session.user.tenantId) {
    return { error: 'Invalid assignee' };
  }

  // Get todos with different assignee (avoid no-ops)
  const todosToUpdate = await prisma.todo.findMany({
    where: {
      id: { in: todoIds },
      assigneeId: { not: assigneeId },
    },
    select: { id: true, assigneeId: true },
  });

  if (todosToUpdate.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToUpdateIds = todosToUpdate.map((t) => t.id);
  const isSelfAssignment = assigneeId === session.user.id;

  const transaction: any[] = [
    prisma.todo.updateMany({
      where: { id: { in: todosToUpdateIds } },
      data: { assigneeId },
    }),
    prisma.todoActivity.createMany({
      data: todosToUpdateIds.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'ASSIGNEE_CHANGED',
        field: 'assigneeId',
        oldValue: todosToUpdate.find((t) => t.id === todoId)?.assigneeId || null,
        newValue: assigneeId,
      })),
    }),
  ];

  // Create notifications only if not self-assignment
  if (!isSelfAssignment) {
    const todoDetails = await prisma.todo.findMany({
      where: { id: { in: todosToUpdateIds } },
      select: { id: true, title: true },
    });

    transaction.push(
      prisma.notification.createMany({
        data: todoDetails.map((todo) => ({
          userId: assigneeId,
          type: 'TODO_ASSIGNED',
          message: `${session.user.email} assigned you to "${todo.title}"`,
          todoId: todo.id,
        })),
      })
    );
  }

  await prisma.$transaction(transaction);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToUpdate.length };
}

// Bulk unassign
export async function bulkUnassign(todoIds: string[]): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Get todos that have an assignee
  const todosToUpdate = await prisma.todo.findMany({
    where: {
      id: { in: todoIds },
      assigneeId: { not: null },
    },
    select: { id: true, assigneeId: true },
  });

  if (todosToUpdate.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToUpdateIds = todosToUpdate.map((t) => t.id);

  await prisma.$transaction([
    prisma.todo.updateMany({
      where: { id: { in: todosToUpdateIds } },
      data: { assigneeId: null },
    }),
    prisma.todoActivity.createMany({
      data: todosToUpdateIds.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'ASSIGNEE_CHANGED',
        field: 'assigneeId',
        oldValue: todosToUpdate.find((t) => t.id === todoId)?.assigneeId,
        newValue: null,
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToUpdate.length };
}

// Bulk add label
export async function bulkAddLabel(
  todoIds: string[],
  labelId: string
): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Validate label belongs to tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true, name: true },
  });

  if (!label || label.tenantId !== session.user.tenantId) {
    return { error: 'Invalid label' };
  }

  // Get todos that don't already have this label
  const existingLabels = await prisma.todoLabel.findMany({
    where: {
      todoId: { in: todoIds },
      labelId,
    },
    select: { todoId: true },
  });

  const existingTodoIds = new Set(existingLabels.map((l) => l.todoId));
  const todosToLabel = todoIds.filter((id) => !existingTodoIds.has(id));

  if (todosToLabel.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  await prisma.$transaction([
    prisma.todoLabel.createMany({
      data: todosToLabel.map((todoId) => ({
        todoId,
        labelId,
      })),
    }),
    prisma.todoActivity.createMany({
      data: todosToLabel.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'LABELS_CHANGED',
        field: 'labels',
        newValue: label.name,
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToLabel.length };
}

// Bulk remove label
export async function bulkRemoveLabel(
  todoIds: string[],
  labelId: string
): Promise<BulkActionResult> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  if (todoIds.length === 0) {
    return { error: 'No todos selected' };
  }

  const isValid = await validateTodoOwnership(todoIds, session.user.tenantId);
  if (!isValid) {
    return { error: 'Invalid todo selection' };
  }

  // Validate label belongs to tenant
  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { tenantId: true, name: true },
  });

  if (!label || label.tenantId !== session.user.tenantId) {
    return { error: 'Invalid label' };
  }

  // Get todos that have this label
  const existingLabels = await prisma.todoLabel.findMany({
    where: {
      todoId: { in: todoIds },
      labelId,
    },
    select: { todoId: true },
  });

  if (existingLabels.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  const todosToUnlabel = existingLabels.map((l) => l.todoId);

  await prisma.$transaction([
    prisma.todoLabel.deleteMany({
      where: {
        todoId: { in: todosToUnlabel },
        labelId,
      },
    }),
    prisma.todoActivity.createMany({
      data: todosToUnlabel.map((todoId) => ({
        todoId,
        actorId: session.user.id,
        action: 'LABELS_CHANGED',
        field: 'labels',
        oldValue: label.name,
      })),
    }),
  ]);

  revalidatePath('/todos');
  return { success: true, affectedCount: todosToUnlabel.length };
}
```

---

## Data Model

No new database models are required. Bulk operations use existing models:
- Todo (status, assigneeId, archivedAt, deletedAt)
- TodoLabel (todoId, labelId)
- TodoActivity (todoId, actorId, action, field, oldValue, newValue)
- Notification (userId, type, message, todoId)

---

## Component Design

### Selection Context Provider

```typescript
// app/contexts/selection-context.tsx
'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type SelectionContextType = {
  selectedIds: Set<string>;
  isSelectionMode: boolean;
  selectTodo: (id: string) => void;
  deselectTodo: (id: string) => void;
  toggleTodo: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
  isSelected: (id: string) => boolean;
};

const SelectionContext = createContext<SelectionContextType | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const selectTodo = useCallback((id: string) => {
    setSelectedIds((prev) => new Set(prev).add(id));
  }, []);

  const deselectTodo = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  return (
    <SelectionContext.Provider
      value={{
        selectedIds,
        isSelectionMode,
        selectTodo,
        deselectTodo,
        toggleTodo,
        selectAll,
        clearSelection,
        enterSelectionMode,
        exitSelectionMode,
        isSelected,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return context;
}
```

### Selection Controls

```typescript
// app/components/selection-controls.tsx
'use client';

import { Button } from '@/components/ui/button';
import { useSelection } from '@/app/contexts/selection-context';
import { CheckSquare, XSquare, X } from 'lucide-react';

type SelectionControlsProps = {
  todoIds: string[];
};

export function SelectionControls({ todoIds }: SelectionControlsProps) {
  const {
    selectedIds,
    isSelectionMode,
    selectAll,
    clearSelection,
    exitSelectionMode,
    enterSelectionMode,
  } = useSelection();

  if (!isSelectionMode) {
    return (
      <Button variant="outline" size="sm" onClick={enterSelectionMode}>
        <CheckSquare className="h-4 w-4 mr-2" />
        Select
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        {selectedIds.size} selected
      </span>
      <Button variant="outline" size="sm" onClick={() => selectAll(todoIds)}>
        Select All
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={clearSelection}
        disabled={selectedIds.size === 0}
      >
        Clear
      </Button>
      <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
        <X className="h-4 w-4 mr-2" />
        Cancel
      </Button>
    </div>
  );
}
```

### Bulk Action Bar

```typescript
// app/components/bulk-action-bar.tsx
'use client';

import { useState } from 'react';
import {
  Check,
  Clock,
  Archive,
  Trash2,
  UserPlus,
  UserMinus,
  Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { useSelection } from '@/app/contexts/selection-context';
import {
  bulkUpdateStatus,
  bulkArchive,
  bulkDelete,
  bulkAssign,
  bulkUnassign,
  bulkAddLabel,
  bulkRemoveLabel,
} from '@/app/actions/bulk';
import { useToast } from '@/components/ui/use-toast';

type BulkActionBarProps = {
  users: { id: string; email: string }[];
  labels: { id: string; name: string; color: string }[];
};

export function BulkActionBar({ users, labels }: BulkActionBarProps) {
  const { selectedIds, clearSelection } = useSelection();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const todoIds = Array.from(selectedIds);
  const count = todoIds.length;

  if (count === 0) {
    return null;
  }

  const handleAction = async (
    action: () => Promise<{ success?: boolean; error?: string; affectedCount?: number }>,
    successMessage: string,
    clearAfter: boolean = false
  ) => {
    setIsLoading(true);
    const result = await action();
    setIsLoading(false);

    if (result.error) {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    } else {
      toast({
        title: 'Success',
        description: `${successMessage} (${result.affectedCount} todos)`,
      });
      if (clearAfter) {
        clearSelection();
      }
    }
  };

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-background border rounded-lg shadow-lg p-2 flex items-center gap-2 z-50">
        <span className="px-2 text-sm font-medium">{count} selected</span>
        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={() =>
            handleAction(
              () => bulkUpdateStatus(todoIds, 'COMPLETED'),
              'Marked as complete'
            )
          }
        >
          <Check className="h-4 w-4 mr-1" />
          Complete
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={() =>
            handleAction(
              () => bulkUpdateStatus(todoIds, 'PENDING'),
              'Marked as pending'
            )
          }
        >
          <Clock className="h-4 w-4 mr-1" />
          Pending
        </Button>

        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          onClick={() =>
            handleAction(() => bulkArchive(todoIds), 'Archived', true)
          }
        >
          <Archive className="h-4 w-4 mr-1" />
          Archive
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isLoading}>
              <UserPlus className="h-4 w-4 mr-1" />
              Assign
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-1">
              {users.map((user) => (
                <Button
                  key={user.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    handleAction(
                      () => bulkAssign(todoIds, user.id),
                      `Assigned to ${user.email}`
                    )
                  }
                >
                  {user.email}
                </Button>
              ))}
              <div className="h-px bg-border my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() =>
                  handleAction(() => bulkUnassign(todoIds), 'Unassigned')
                }
              >
                <UserMinus className="h-4 w-4 mr-2" />
                Unassign
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isLoading}>
              <Tag className="h-4 w-4 mr-1" />
              Label
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground px-2 py-1">Add label</p>
              {labels.map((label) => (
                <Button
                  key={label.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() =>
                    handleAction(
                      () => bulkAddLabel(todoIds, label.id),
                      `Added label "${label.name}"`
                    )
                  }
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Button>
              ))}
              <div className="h-px bg-border my-1" />
              <p className="text-xs text-muted-foreground px-2 py-1">Remove label</p>
              {labels.map((label) => (
                <Button
                  key={`remove-${label.id}`}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() =>
                    handleAction(
                      () => bulkRemoveLabel(todoIds, label.id),
                      `Removed label "${label.name}"`
                    )
                  }
                >
                  <span
                    className="w-3 h-3 rounded-full mr-2 opacity-50"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-6 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          disabled={isLoading}
          className="text-destructive hover:text-destructive"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Delete
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} todos?</AlertDialogTitle>
            <AlertDialogDescription>
              This will move {count} todos to trash. You can restore them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                handleAction(() => bulkDelete(todoIds), 'Deleted', true)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

### Todo Card with Selection

```typescript
// app/components/todo-card.tsx (modification)
// Add checkbox to existing TodoCard component

import { Checkbox } from '@/components/ui/checkbox';
import { useSelection } from '@/app/contexts/selection-context';
import { cn } from '@/lib/utils';

// Inside TodoCard component, add:
const { isSelectionMode, isSelected, toggleTodo } = useSelection();
const selected = isSelected(todo.id);

// Render checkbox when in selection mode
{isSelectionMode && (
  <div className="flex items-center pr-3">
    <Checkbox
      checked={selected}
      onCheckedChange={() => toggleTodo(todo.id)}
      onClick={(e) => e.stopPropagation()}
    />
  </div>
)}

// Add highlight class when selected
<Card className={cn(
  "...",
  selected && "ring-2 ring-primary"
)}>
```

### Todos Page Integration

```typescript
// app/(app)/todos/page.tsx (modification)
// Wrap with SelectionProvider and add components

import { SelectionProvider } from '@/app/contexts/selection-context';
import { SelectionControls } from '@/app/components/selection-controls';
import { BulkActionBar } from '@/app/components/bulk-action-bar';

// In page component:
const todoIds = todos.map((t) => t.id);
const users = await getTenantMembers();
const labels = await getLabels();

return (
  <SelectionProvider>
    <div className="container py-6">
      <div className="flex items-center justify-between mb-6">
        <h1>Todos</h1>
        <SelectionControls todoIds={todoIds} />
      </div>
      <TodoList todos={todos} />
      <BulkActionBar users={users} labels={labels} />
    </div>
  </SelectionProvider>
);
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Checkbox always visible | Fewer clicks | Cluttered UI | Selection mode keeps UI clean |
| Drag-to-select | Intuitive | Complex implementation, touch issues | Can add later |
| Keyboard shortcuts | Power users | Accessibility concerns | Can add later |
| Global selection state | Works across pages | Confusing when filtering | Page-scoped is clearer |

---

## Security Considerations

- **Authorization**: All bulk actions verify todos belong to user's tenant
- **Transaction safety**: Bulk operations are atomic (all-or-nothing)
- **Input validation**: Todo IDs validated before operations
- **Rate limiting**: Natural limit by page size (10-50 items)
- **Notification safety**: Only non-self assignments generate notifications

---

## Testing Strategy

**Unit Tests**
- bulkUpdateStatus: updates status for all todos
- bulkUpdateStatus: creates activity entries for each todo
- bulkUpdateStatus: skips todos already in target status
- bulkUpdateStatus: fails for invalid tenant
- bulkArchive: sets archivedAt for all todos
- bulkArchive: creates activity entries
- bulkArchive: skips already archived todos
- bulkDelete: sets deletedAt for all todos
- bulkDelete: creates activity entries
- bulkDelete: skips already deleted todos
- bulkAssign: sets assigneeId for all todos
- bulkAssign: creates notifications (not self)
- bulkAssign: skips todos already assigned to user
- bulkAssign: fails for invalid assignee
- bulkUnassign: clears assigneeId for all todos
- bulkUnassign: skips unassigned todos
- bulkAddLabel: creates TodoLabel records
- bulkAddLabel: skips todos that already have label
- bulkAddLabel: fails for invalid label
- bulkRemoveLabel: deletes TodoLabel records
- bulkRemoveLabel: skips todos without label
- validateTodoOwnership: returns false for other tenant's todos

**E2E Tests**
- Entering selection mode shows checkboxes
- Selecting todo adds to selection
- Deselecting todo removes from selection
- Select all selects all visible todos
- Clear selection deselects all
- Cancel exits selection mode
- Action bar appears when 1+ selected
- Bulk complete marks todos as complete
- Bulk pending marks todos as pending
- Bulk archive removes from list
- Bulk delete shows confirmation
- Bulk delete moves to trash
- Bulk assign assigns to selected user
- Bulk unassign clears assignee
- Bulk add label adds label to todos
- Bulk remove label removes label from todos
- Selection persists after non-destructive actions
- Selection clears after archive/delete

---

## Deployment

No special deployment considerations. No database migrations required - uses existing models.

---

## Tickets

Tickets should be created in this order:

1. **feat(ui): add SelectionProvider context**
   - Create SelectionProvider with selection state
   - Add useSelection hook
   - Implement select, deselect, toggle, selectAll, clearSelection
   - Implement enter/exit selection mode
   - Add unit tests for context
   - Depends on: None

2. **feat(ui): add SelectionControls component**
   - Create SelectionControls component
   - Show "Select" button when not in selection mode
   - Show "Select All", "Clear", "Cancel" in selection mode
   - Show selection count
   - Depends on: #1

3. **feat(ui): add selection checkbox to TodoCard**
   - Modify TodoCard to show checkbox in selection mode
   - Add visual highlight for selected cards
   - Handle checkbox click without opening edit dialog
   - Depends on: #1

4. **feat(api): add bulkUpdateStatus server action**
   - Implement bulkUpdateStatus for COMPLETED and PENDING
   - Validate tenant ownership
   - Execute in transaction
   - Create activity entries
   - Skip no-op updates
   - Add unit tests
   - Depends on: None

5. **feat(api): add bulkArchive server action**
   - Implement bulkArchive action
   - Set archivedAt for selected todos
   - Validate tenant ownership
   - Create activity entries
   - Add unit tests
   - Depends on: None

6. **feat(api): add bulkDelete server action**
   - Implement bulkDelete action
   - Set deletedAt for selected todos
   - Validate tenant ownership
   - Create activity entries
   - Add unit tests
   - Depends on: None

7. **feat(api): add bulkAssign server action**
   - Implement bulkAssign action
   - Validate assignee belongs to tenant
   - Create activity entries
   - Create notifications (not self-assignment)
   - Add unit tests
   - Depends on: None

8. **feat(api): add bulkUnassign server action**
   - Implement bulkUnassign action
   - Clear assigneeId for selected todos
   - Create activity entries
   - Add unit tests
   - Depends on: None

9. **feat(api): add bulkAddLabel server action**
   - Implement bulkAddLabel action
   - Validate label belongs to tenant
   - Skip todos that already have label
   - Create activity entries
   - Add unit tests
   - Depends on: None

10. **feat(api): add bulkRemoveLabel server action**
    - Implement bulkRemoveLabel action
    - Validate label belongs to tenant
    - Skip todos without label
    - Create activity entries
    - Add unit tests
    - Depends on: None

11. **feat(ui): add BulkActionBar component**
    - Create floating action bar component
    - Show when 1+ todos selected
    - Add buttons for all bulk actions
    - Fixed position at bottom of viewport
    - Depends on: #1, #4, #5, #6, #7, #8, #9, #10

12. **feat(ui): add AssignPopover to BulkActionBar**
    - Create popover with tenant members list
    - Allow selecting user to assign
    - Include unassign option
    - Depends on: #11

13. **feat(ui): add LabelPopover to BulkActionBar**
    - Create popover with tenant labels
    - Section for adding labels
    - Section for removing labels
    - Depends on: #11

14. **feat(ui): add delete confirmation dialog**
    - Add AlertDialog for bulk delete confirmation
    - Show count of todos being deleted
    - Explain items go to trash
    - Depends on: #11

15. **feat(ui): integrate selection into todos page**
    - Wrap todos page with SelectionProvider
    - Add SelectionControls to header
    - Add BulkActionBar to page
    - Pass users and labels to action bar
    - Depends on: #2, #3, #11

16. **test(e2e): add E2E tests for selection mode**
    - Test entering selection mode
    - Test selecting and deselecting todos
    - Test select all and clear
    - Test cancel exits selection mode
    - Test action bar visibility
    - Depends on: #15

17. **test(e2e): add E2E tests for bulk actions**
    - Test bulk complete
    - Test bulk pending
    - Test bulk archive
    - Test bulk delete with confirmation
    - Test bulk assign
    - Test bulk unassign
    - Test bulk add label
    - Test bulk remove label
    - Test selection behavior after actions
    - Depends on: #15

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Button, Checkbox, Popover, AlertDialog, Card)
- Uses lucide-react icons (Check, Clock, Archive, Trash2, UserPlus, UserMinus, Tag, CheckSquare, XSquare, X)
- Uses existing server actions patterns
- Uses existing activity log patterns (PRD-0017)
- Uses existing notification patterns (PRD-0016)

