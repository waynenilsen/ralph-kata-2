ERD: 0015
Title: Recurring Todos
Author: Engineering
Status: Draft
PRD: [PRD-0015](../prd/0015-recurring-todos.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding recurring (repeating) todos. Users can set todos to repeat on a schedule (daily, weekly, biweekly, monthly, yearly). When a recurring todo is completed, the system automatically generates the next instance with an updated due date.

---

## Background

- PRD-0015 defines the product requirements for recurring todos
- PRD-0001 established the multi-tenant todo system with Todo model including dueDate
- PRD-0010 added assignees, which should be copied to recurring instances
- PRD-0012 added labels, which should also be copied to recurring instances
- Recurring tasks are a standard feature in task management tools (Todoist, Asana, Things)

---

## Goals and Non-Goals

**Goals:**
- Add recurrence fields to the Todo model
- Allow users to set recurrence when creating or editing todos with due dates
- Automatically generate the next instance when a recurring todo is completed
- Copy title, description, labels, assignee, and recurrence settings to new instances
- Calculate new due date based on recurrence interval from original due date
- Display recurrence indicator on todo cards
- Provide UI to edit/disable recurrence in todo edit dialog

**Non-Goals:**
- Complex recurrence patterns (e.g., "every 3rd Thursday")
- Custom intervals (e.g., every 3 days)
- End dates for recurrence
- Viewing/editing future occurrences before they're generated
- Recurring subtask templates
- Automatic assignment rotation
- Calendar integrations

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
│  Todo Card  │────▶│ Edit Dialog │────▶│ Recurrence  │
│  (repeat ↻) │     │  + Repeat   │     │   Select    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  Complete   │
                    │   Action    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Generate   │
                    │ Next Todo   │
                    └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Todo model extensions | Stores recurrenceType field |
| updateTodoRecurrence action | Server action to set/modify recurrence |
| completeTodo action (extended) | Generates next instance when completing recurring todo |
| generateNextRecurringTodo | Helper function to create next todo instance |
| RecurrenceSelect | UI component for selecting recurrence type |
| Todo card indicator | Shows repeat icon when todo is recurring |

**Data Flow**

1. User creates/edits todo and sets recurrence type
2. Todo saved with recurrenceType field populated
3. Todo card displays recurrence indicator
4. When user marks todo as complete:
   a. Todo status set to COMPLETED
   b. If recurrenceType is not NONE, trigger generation
   c. generateNextRecurringTodo creates new todo instance
   d. New instance has calculated due date and same properties
5. Page revalidates, showing completed todo and new pending instance

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Todo model shall have recurrenceType enum field (NONE, DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY) | Must |
| REQ-002 | recurrenceType shall default to NONE | Must |
| REQ-003 | Recurrence shall only be settable when dueDate is present | Must |
| REQ-004 | Completing a recurring todo shall create a new PENDING todo | Must |
| REQ-005 | New instance shall copy title, description, labels, assignee, recurrenceType | Must |
| REQ-006 | New instance shall NOT copy comments or subtasks | Must |
| REQ-007 | New instance due date shall be calculated from original dueDate + interval | Must |
| REQ-008 | Monthly recurrence shall handle month-end edge cases (Jan 31 + 1mo = Feb 28) | Must |
| REQ-009 | Yearly recurrence shall handle leap year edge cases (Feb 29 + 1yr = Feb 28) | Must |
| REQ-010 | Todo card shall display repeat icon when recurrenceType is not NONE | Must |
| REQ-011 | Server actions shall verify user belongs to same tenant as todo | Must |
| REQ-012 | Removing dueDate should automatically set recurrenceType to NONE | Should |
| REQ-013 | UI should disable recurrence select when no dueDate is set | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/todos.ts (extend existing)
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { RecurrenceType } from '@prisma/client';
import { addDays, addWeeks, addMonths, addYears, lastDayOfMonth, getDate, setDate } from 'date-fns';

export type TodoActionState = {
  success?: boolean;
  error?: string;
};

// Calculate next due date based on recurrence type
function calculateNextDueDate(currentDueDate: Date, recurrenceType: RecurrenceType): Date {
  switch (recurrenceType) {
    case 'DAILY':
      return addDays(currentDueDate, 1);
    case 'WEEKLY':
      return addDays(currentDueDate, 7);
    case 'BIWEEKLY':
      return addDays(currentDueDate, 14);
    case 'MONTHLY': {
      // Handle month-end edge cases
      const originalDay = getDate(currentDueDate);
      const nextMonth = addMonths(currentDueDate, 1);
      const lastDayOfNextMonth = getDate(lastDayOfMonth(nextMonth));

      // If original day doesn't exist in next month, use last day
      if (originalDay > lastDayOfNextMonth) {
        return lastDayOfMonth(nextMonth);
      }
      return setDate(nextMonth, originalDay);
    }
    case 'YEARLY': {
      // Handle Feb 29 edge case
      const originalDay = getDate(currentDueDate);
      const nextYear = addYears(currentDueDate, 1);
      const lastDayOfNextYearMonth = getDate(lastDayOfMonth(nextYear));

      if (originalDay > lastDayOfNextYearMonth) {
        return lastDayOfMonth(nextYear);
      }
      return setDate(nextYear, originalDay);
    }
    default:
      return currentDueDate;
  }
}

// Generate the next recurring todo instance
async function generateNextRecurringTodo(completedTodoId: string): Promise<void> {
  const completedTodo = await prisma.todo.findUnique({
    where: { id: completedTodoId },
    include: {
      labels: { include: { label: true } },
    },
  });

  if (!completedTodo || completedTodo.recurrenceType === 'NONE' || !completedTodo.dueDate) {
    return;
  }

  const nextDueDate = calculateNextDueDate(completedTodo.dueDate, completedTodo.recurrenceType);

  // Create new todo instance
  const newTodo = await prisma.todo.create({
    data: {
      title: completedTodo.title,
      description: completedTodo.description,
      status: 'PENDING',
      dueDate: nextDueDate,
      recurrenceType: completedTodo.recurrenceType,
      tenantId: completedTodo.tenantId,
      createdById: completedTodo.createdById,
      assigneeId: completedTodo.assigneeId,
    },
  });

  // Copy labels to new todo
  if (completedTodo.labels.length > 0) {
    await prisma.todoLabel.createMany({
      data: completedTodo.labels.map((tl) => ({
        todoId: newTodo.id,
        labelId: tl.labelId,
      })),
    });
  }
}

// Extend completeTodo action to handle recurrence
export async function completeTodo(todoId: string): Promise<TodoActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, recurrenceType: true, dueDate: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  // Mark as completed
  await prisma.todo.update({
    where: { id: todoId },
    data: { status: 'COMPLETED' },
  });

  // Generate next instance if recurring
  if (todo.recurrenceType !== 'NONE' && todo.dueDate) {
    await generateNextRecurringTodo(todoId);
  }

  revalidatePath('/todos');
  return { success: true };
}

// Update recurrence settings
export async function updateTodoRecurrence(
  todoId: string,
  recurrenceType: RecurrenceType
): Promise<TodoActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, dueDate: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  // Can only set recurrence if due date exists
  if (recurrenceType !== 'NONE' && !todo.dueDate) {
    return { error: 'Cannot set recurrence without a due date' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { recurrenceType },
  });

  revalidatePath('/todos');
  return { success: true };
}
```

### Data Fetching

Existing todo queries naturally include the new field:

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

// recurrenceType is automatically included on the todo object
```

---

## Data Model

### Prisma Enum

```prisma
// prisma/schema.prisma - add enum
enum RecurrenceType {
  NONE
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  YEARLY
}
```

### Model Updates

```prisma
// prisma/todo.prisma - add field
model Todo {
  // ... existing fields ...
  recurrenceType RecurrenceType @default(NONE)
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### RecurrenceSelect

```typescript
// app/(app)/todos/recurrence-select.tsx
'use client';

import { useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RecurrenceType } from '@prisma/client';
import { updateTodoRecurrence } from '@/app/actions/todos';

type RecurrenceSelectProps = {
  todoId: string;
  value: RecurrenceType;
  disabled?: boolean;
  onChange?: (value: RecurrenceType) => void;
};

const recurrenceLabels: Record<RecurrenceType, string> = {
  NONE: 'Never',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Biweekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

export function RecurrenceSelect({ todoId, value, disabled, onChange }: RecurrenceSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (newValue: RecurrenceType) => {
    if (onChange) {
      onChange(newValue);
    } else {
      startTransition(async () => {
        await updateTodoRecurrence(todoId, newValue);
      });
    }
  };

  return (
    <Select
      value={value}
      onValueChange={handleChange}
      disabled={disabled || isPending}
    >
      <SelectTrigger className="w-[140px]">
        <SelectValue placeholder="Repeat" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(recurrenceLabels).map(([key, label]) => (
          <SelectItem key={key} value={key}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### For Create/Edit Form Integration

```typescript
// In the todo create/edit form, add recurrence select near due date
<div className="flex items-center gap-2">
  <DatePicker
    value={dueDate}
    onChange={setDueDate}
  />
  <RecurrenceSelect
    todoId={todoId}
    value={recurrenceType}
    disabled={!dueDate}
    onChange={setRecurrenceType}
  />
</div>
{!dueDate && recurrenceType !== 'NONE' && (
  <p className="text-sm text-muted-foreground">
    Set a due date to enable recurrence
  </p>
)}
```

### Todo Card Recurrence Indicator

```typescript
// In todo-card.tsx, add recurrence indicator
import { Repeat } from 'lucide-react';

// Add to the card metadata section
{todo.recurrenceType !== 'NONE' && (
  <div className="flex items-center gap-1 text-muted-foreground text-xs">
    <Repeat className="h-3 w-3" />
    <span>{recurrenceLabels[todo.recurrenceType]}</span>
  </div>
)}
```

---

## Date Calculation Examples

| Original Due Date | Recurrence | Next Due Date |
|-------------------|------------|---------------|
| 2026-01-15 | Daily | 2026-01-16 |
| 2026-01-15 | Weekly | 2026-01-22 |
| 2026-01-15 | Biweekly | 2026-01-29 |
| 2026-01-15 | Monthly | 2026-02-15 |
| 2026-01-31 | Monthly | 2026-02-28 (last day) |
| 2026-03-31 | Monthly | 2026-04-30 (last day) |
| 2024-02-29 | Yearly | 2025-02-28 (non-leap) |
| 2026-01-15 | Yearly | 2027-01-15 |

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Cron-based generation | Generate ahead of time | Complex, over-generates, needs cleanup | Completion-triggered is simpler |
| Store all future instances | See upcoming tasks | Database bloat, hard to edit series | Generate on-demand is cleaner |
| RFC 5545 (iCalendar RRULE) | Standard, powerful | Very complex parsing, overkill | Simple intervals sufficient |
| Separate RecurringTodo model | Clear separation | Two tables to manage, complex joins | Single model with field is simpler |

---

## Security Considerations

- **Authorization**: All actions verify user's tenant matches todo's tenant
- **Input validation**: RecurrenceType is an enum, invalid values rejected
- **No elevation**: Generated todos inherit same tenant, preventing cross-tenant leakage
- **Due date requirement**: Recurrence requires due date, preventing invalid state

---

## Testing Strategy

**Unit Tests**
- calculateNextDueDate: all recurrence types, edge cases (month-end, leap year)
- completeTodo: generates next instance for recurring, no generation for non-recurring
- updateTodoRecurrence: validation, tenant verification
- generateNextRecurringTodo: copies correct fields, excludes comments/subtasks

**E2E Tests**
- User can set recurrence on todo with due date
- User cannot set recurrence on todo without due date
- Completing recurring todo creates new pending todo
- New todo has correct due date based on interval
- New todo has same labels and assignee
- New todo does not have old comments/subtasks
- Recurrence indicator shows on todo card
- User can change recurrence interval
- User can disable recurrence
- Removing due date disables recurrence

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

Requires `date-fns` library for date calculations (likely already installed, common in Next.js projects).

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add RecurrenceType enum and field to Todo model**
   - Add RecurrenceType enum to Prisma schema (NONE, DAILY, WEEKLY, BIWEEKLY, MONTHLY, YEARLY)
   - Add recurrenceType field to Todo model with default NONE
   - Run migration
   - Depends on: None

2. **feat(api): add recurrence date calculation helper**
   - Implement calculateNextDueDate function
   - Handle all recurrence types
   - Handle month-end edge cases for monthly
   - Handle leap year edge cases for yearly
   - Add unit tests for all cases
   - Depends on: #1

3. **feat(api): extend completeTodo to generate recurring instances**
   - Implement generateNextRecurringTodo helper
   - Copy title, description, assignee, recurrenceType to new instance
   - Copy labels via TodoLabel junction table
   - Calculate new due date using helper
   - Call generation when completing recurring todo
   - Add unit tests
   - Depends on: #2

4. **feat(api): add updateTodoRecurrence server action**
   - Implement updateTodoRecurrence action
   - Validate recurrence requires due date
   - Add tenant verification
   - Add unit tests
   - Depends on: #1

5. **feat(ui): add RecurrenceSelect component**
   - Create RecurrenceSelect dropdown component
   - Support controlled and uncontrolled modes
   - Integrate into todo create/edit form near due date
   - Disable when no due date is set
   - Depends on: #4

6. **feat(ui): add recurrence indicator to todo cards**
   - Add Repeat icon from lucide-react
   - Show recurrence type label (e.g., "Weekly")
   - Only show when recurrenceType is not NONE
   - Depends on: #1

7. **test(e2e): add E2E tests for recurring todos**
   - Test setting recurrence on todo
   - Test recurrence disabled without due date
   - Test completing recurring todo creates new instance
   - Test new instance has correct due date
   - Test labels/assignee copied, comments/subtasks not copied
   - Test editing recurrence interval
   - Test disabling recurrence
   - Depends on: #5, #6

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Select)
- Uses lucide-react icons (Repeat)
- Uses date-fns for date calculations (addDays, addMonths, addYears, etc.)
