ERD: 0017
Title: Todo Activity Log
Author: Engineering
Status: Draft
PRD: [PRD-0017](../prd/0017-todo-activity-log.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding activity logs to todos. Activity logs record changes to todo fields (status, assignee, due date, labels, description) with information about who made the change and when. Users can view the activity log in the todo edit dialog to understand task history.

---

## Background

- PRD-0017 defines the product requirements for todo activity logs
- PRD-0001 established the multi-tenant todo system
- PRD-0010 added assignees, creating changes worth tracking
- PRD-0012 added labels, creating additional trackable changes
- PRD-0016 added notifications for immediate awareness; activity logs provide the persistent audit trail

---

## Goals and Non-Goals

**Goals:**
- Create TodoActivity model to store change history
- Automatically record activity when todos are created or modified
- Track changes to: status, assignee, due date, labels, description
- Display activity log in todo edit dialog
- Show actor, action description, and timestamp for each entry
- Store old/new values for meaningful change tracking

**Non-Goals:**
- Real-time activity updates (page refresh shows changes)
- Activity for subtask changes
- Activity search or filtering
- Undo/revert functionality
- Activity export
- Activity aggregation ("3 changes by Alice")
- Custom retention periods (keep all history)

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
│   Create    │────▶│   Create    │────▶│ TodoActivity│
│    Todo     │     │  Activity   │     │   Table     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
┌─────────────┐            │
│   Update    │────────────┘
│    Todo     │
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Todo Edit  │────▶│  Activity   │────▶│ Collapsible │
│   Dialog    │     │   Section   │     │   List      │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| TodoActivity model | Stores activity entries |
| createTodoActivity helper | Creates activity records |
| getTodoActivities action | Fetches activities for a todo |
| ActivitySection | Collapsible activity list in dialog |
| ActivityItem | Individual activity entry display |

**Data Flow**

1. User creates a todo
   a. createTodo action creates the todo
   b. createTodoActivity called with action CREATED
   c. Activity stored with todoId, actorId, no old/new values
2. User updates a todo field
   a. updateTodo action detects field changes
   b. For each changed field, createTodoActivity called
   c. Activity stored with old/new values for the field
3. User views todo activity:
   a. Todo edit dialog opens
   b. Activity section shows collapsed with count
   c. User expands to see full activity list
   d. Each entry shows actor, description, timestamp

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | TodoActivity model shall have id, todoId, actorId, action, field, oldValue, newValue, createdAt | Must |
| REQ-002 | ActivityAction shall be an enum with CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, DUE_DATE_CHANGED, LABELS_CHANGED, DESCRIPTION_CHANGED | Must |
| REQ-003 | Activity shall be created when a todo is created | Must |
| REQ-004 | Activity shall be created when status, assignee, due date, labels, or description changes | Must |
| REQ-005 | Activity shall not be created for no-op changes (same value) | Must |
| REQ-006 | Activity entries shall be immutable (no update/delete) | Must |
| REQ-007 | Todo edit dialog shall display activity section | Must |
| REQ-008 | Activity section shall be collapsible, collapsed by default | Must |
| REQ-009 | Activity section header shall show count | Must |
| REQ-010 | Each activity entry shall display actor name, action description, relative timestamp | Must |
| REQ-011 | Activities shall be ordered by createdAt descending (newest first) | Must |
| REQ-012 | Activities shall be deleted when parent todo is deleted (cascade) | Must |
| REQ-013 | Activity table shall be indexed on todoId | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/activities.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityAction } from '@prisma/client';

export type Activity = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: ActivityAction;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
};

// Create activity entry (internal helper)
export async function createTodoActivity(data: {
  todoId: string;
  actorId: string;
  action: ActivityAction;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
}): Promise<void> {
  await prisma.todoActivity.create({
    data: {
      todoId: data.todoId,
      actorId: data.actorId,
      action: data.action,
      field: data.field ?? null,
      oldValue: data.oldValue ?? null,
      newValue: data.newValue ?? null,
    },
  });
}

// Get activities for a todo
export async function getTodoActivities(todoId: string): Promise<{
  activities: Activity[];
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { activities: [], error: 'Not authenticated' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { activities: [], error: 'Todo not found' };
  }

  const activities = await prisma.todoActivity.findMany({
    where: { todoId },
    orderBy: { createdAt: 'desc' },
    include: {
      actor: {
        select: { email: true },
      },
    },
  });

  return {
    activities: activities.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      actorEmail: a.actor.email,
      action: a.action,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      createdAt: a.createdAt,
    })),
  };
}
```

### Integration with Existing Actions

```typescript
// app/actions/todos.ts - extend createTodo
export async function createTodo(data: CreateTodoInput): Promise<TodoActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      tenantId: session.user.tenantId,
      createdById: session.user.id,
    },
  });

  // Create activity for todo creation
  await createTodoActivity({
    todoId: todo.id,
    actorId: session.user.id,
    action: 'CREATED',
  });

  revalidatePath('/todos');
  return { success: true, todo };
}

// app/actions/todos.ts - extend updateTodo
export async function updateTodo(
  todoId: string,
  data: UpdateTodoInput
): Promise<TodoActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const existingTodo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: {
      tenantId: true,
      status: true,
      assigneeId: true,
      dueDate: true,
      description: true,
    },
  });

  if (!existingTodo || existingTodo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  const todo = await prisma.todo.update({
    where: { id: todoId },
    data,
  });

  // Create activity for each changed field
  if (data.status !== undefined && data.status !== existingTodo.status) {
    await createTodoActivity({
      todoId,
      actorId: session.user.id,
      action: 'STATUS_CHANGED',
      field: 'status',
      oldValue: existingTodo.status,
      newValue: data.status,
    });
  }

  if (data.assigneeId !== undefined && data.assigneeId !== existingTodo.assigneeId) {
    await createTodoActivity({
      todoId,
      actorId: session.user.id,
      action: 'ASSIGNEE_CHANGED',
      field: 'assigneeId',
      oldValue: existingTodo.assigneeId,
      newValue: data.assigneeId,
    });
  }

  if (data.dueDate !== undefined &&
      data.dueDate?.toISOString() !== existingTodo.dueDate?.toISOString()) {
    await createTodoActivity({
      todoId,
      actorId: session.user.id,
      action: 'DUE_DATE_CHANGED',
      field: 'dueDate',
      oldValue: existingTodo.dueDate?.toISOString() ?? null,
      newValue: data.dueDate?.toISOString() ?? null,
    });
  }

  if (data.description !== undefined && data.description !== existingTodo.description) {
    await createTodoActivity({
      todoId,
      actorId: session.user.id,
      action: 'DESCRIPTION_CHANGED',
      field: 'description',
      // Don't store full description text, just note it changed
      oldValue: null,
      newValue: null,
    });
  }

  revalidatePath('/todos');
  return { success: true, todo };
}

// app/actions/labels.ts - extend addLabelToTodo / removeLabelFromTodo
export async function addLabelToTodo(
  todoId: string,
  labelId: string
): Promise<LabelActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  // ... existing validation and logic ...

  await prisma.todoLabel.create({
    data: { todoId, labelId },
  });

  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { name: true },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'LABELS_CHANGED',
    field: 'labels',
    oldValue: null,
    newValue: label?.name ?? labelId, // Store label name for display
  });

  revalidatePath('/todos');
  return { success: true };
}

export async function removeLabelFromTodo(
  todoId: string,
  labelId: string
): Promise<LabelActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  // ... existing validation and logic ...

  const label = await prisma.label.findUnique({
    where: { id: labelId },
    select: { name: true },
  });

  await prisma.todoLabel.delete({
    where: { todoId_labelId: { todoId, labelId } },
  });

  await createTodoActivity({
    todoId,
    actorId: session.user.id,
    action: 'LABELS_CHANGED',
    field: 'labels',
    oldValue: label?.name ?? labelId, // Store label name for display
    newValue: null,
  });

  revalidatePath('/todos');
  return { success: true };
}
```

---

## Data Model

### Prisma Enum

```prisma
// prisma/schema.prisma - add enum
enum ActivityAction {
  CREATED
  STATUS_CHANGED
  ASSIGNEE_CHANGED
  DUE_DATE_CHANGED
  LABELS_CHANGED
  DESCRIPTION_CHANGED
}
```

### TodoActivity Model

```prisma
// prisma/todo-activity.prisma
model TodoActivity {
  id        String         @id @default(cuid())
  todoId    String
  todo      Todo           @relation(fields: [todoId], references: [id], onDelete: Cascade)
  actorId   String
  actor     User           @relation(fields: [actorId], references: [id], onDelete: Cascade)
  action    ActivityAction
  field     String?
  oldValue  String?
  newValue  String?
  createdAt DateTime       @default(now())

  @@index([todoId])
  @@index([todoId, createdAt])
}
```

### Model Updates

```prisma
// prisma/user.prisma - add relation
model User {
  // ... existing fields ...
  activities TodoActivity[]
}

// prisma/todo.prisma - add relation
model Todo {
  // ... existing fields ...
  activities TodoActivity[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### ActivitySection

```typescript
// app/components/activity-section.tsx
'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getTodoActivities, Activity } from '@/app/actions/activities';
import { ActivityItem } from './activity-item';

type ActivitySectionProps = {
  todoId: string;
};

export function ActivitySection({ todoId }: ActivitySectionProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    getTodoActivities(todoId).then((result) => {
      if (result.activities) {
        setActivities(result.activities);
      }
      setLoading(false);
    });
  }, [todoId]);

  if (loading) {
    return (
      <div className="py-3 text-sm text-muted-foreground">
        Loading activity...
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-0 hover:bg-transparent">
          {isOpen ? (
            <ChevronDown className="h-4 w-4 mr-2" />
          ) : (
            <ChevronRight className="h-4 w-4 mr-2" />
          )}
          <span className="font-medium">Activity</span>
          <span className="text-muted-foreground ml-2">({activities.length})</span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1 pl-6">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
```

### ActivityItem

```typescript
// app/components/activity-item.tsx
'use client';

import { formatDistanceToNow } from 'date-fns';
import { Activity } from '@/app/actions/activities';
import { ActivityAction } from '@prisma/client';

type ActivityItemProps = {
  activity: Activity;
};

function getActivityMessage(activity: Activity): string {
  const actor = activity.actorEmail.split('@')[0]; // Use username part for brevity

  switch (activity.action) {
    case 'CREATED':
      return `${actor} created this todo`;
    case 'STATUS_CHANGED':
      return `${actor} changed status from ${activity.oldValue} to ${activity.newValue}`;
    case 'ASSIGNEE_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} assigned this todo`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed assignee`;
      }
      return `${actor} changed assignee`;
    case 'DUE_DATE_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} set due date`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed due date`;
      }
      return `${actor} changed due date`;
    case 'LABELS_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} added label "${activity.newValue}"`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed label "${activity.oldValue}"`;
      }
      return `${actor} changed labels`;
    case 'DESCRIPTION_CHANGED':
      return `${actor} updated the description`;
    default:
      return `${actor} made a change`;
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const message = getActivityMessage(activity);
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

  return (
    <div className="flex items-start gap-2 py-2 text-sm border-b last:border-b-0">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
        {activity.actorEmail[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}
```

### Dialog Integration

```typescript
// In todo edit dialog, add ActivitySection after subtasks
import { ActivitySection } from '@/app/components/activity-section';

// Inside the dialog component
<div className="space-y-6">
  {/* ... existing form fields ... */}

  {/* Subtasks section */}
  <SubtasksSection todoId={todo.id} />

  {/* Activity section */}
  <div className="border-t pt-4">
    <ActivitySection todoId={todo.id} />
  </div>

  {/* ... save button ... */}
</div>
```

---

## Activity Message Formatting

| Action | Message Format | Example |
|--------|----------------|---------|
| CREATED | "{actor} created this todo" | "alice created this todo" |
| STATUS_CHANGED | "{actor} changed status from {old} to {new}" | "alice changed status from PENDING to COMPLETED" |
| ASSIGNEE_CHANGED | "{actor} assigned this todo" (when adding) | "alice assigned this todo" |
| ASSIGNEE_CHANGED | "{actor} removed assignee" (when removing) | "alice removed assignee" |
| DUE_DATE_CHANGED | "{actor} set due date" (when adding) | "alice set due date" |
| DUE_DATE_CHANGED | "{actor} removed due date" (when removing) | "alice removed due date" |
| DUE_DATE_CHANGED | "{actor} changed due date" (when modifying) | "alice changed due date" |
| LABELS_CHANGED | "{actor} added label \"{label}\"" (when adding) | "alice added label \"urgent\"" |
| LABELS_CHANGED | "{actor} removed label \"{label}\"" (when removing) | "alice removed label \"urgent\"" |
| DESCRIPTION_CHANGED | "{actor} updated the description" | "alice updated the description" |

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Event sourcing | Complete history, replay | Complex, overkill | Simple changelog sufficient |
| Store full before/after | Rich diffing | Large data, privacy | Most changes don't need full text |
| Activity on every field | Fine-grained | Too much noise | Selected fields are sufficient |
| Separate activity table per todo | Isolated | Complex queries, migrations | Single table with todoId is simpler |

---

## Security Considerations

- **Authorization**: getTodoActivities verifies todo belongs to user's tenant
- **No modification**: Activities are append-only, no update/delete actions exposed
- **Actor verification**: actorId is always set from session.user.id, not user input
- **Description privacy**: Full description text not stored in activity, just change indicator
- **Cascade delete**: Activities deleted with parent todo (no orphan data)

---

## Testing Strategy

**Unit Tests**
- createTodoActivity: creates activity with correct fields
- getTodoActivities: returns only activities for specified todo
- getTodoActivities: verifies tenant authorization
- createTodo: creates CREATED activity
- updateTodo: creates activity for each changed field
- updateTodo: no activity for unchanged fields
- addLabelToTodo: creates LABELS_CHANGED activity
- removeLabelFromTodo: creates LABELS_CHANGED activity

**E2E Tests**
- Creating a todo shows CREATED in activity
- Changing status shows STATUS_CHANGED in activity
- Assigning todo shows ASSIGNEE_CHANGED in activity
- Changing due date shows DUE_DATE_CHANGED in activity
- Adding label shows LABELS_CHANGED in activity
- Removing label shows LABELS_CHANGED in activity
- Editing description shows DESCRIPTION_CHANGED in activity
- Activity section is collapsed by default
- Activity section shows correct count
- Activity entries display actor and timestamp
- Activities are ordered newest first
- Deleting todo removes all activities

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

Uses date-fns for relative time formatting (formatDistanceToNow).

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add TodoActivity model and ActivityAction enum**
   - Add ActivityAction enum (CREATED, STATUS_CHANGED, ASSIGNEE_CHANGED, DUE_DATE_CHANGED, LABELS_CHANGED, DESCRIPTION_CHANGED)
   - Create TodoActivity model with todoId, actorId, action, field, oldValue, newValue, createdAt
   - Add relation to User model
   - Add relation to Todo model (onDelete: Cascade)
   - Add indexes on todoId and (todoId, createdAt)
   - Run migration
   - Depends on: None

2. **feat(api): add activity server actions**
   - Implement createTodoActivity helper function
   - Implement getTodoActivities action with tenant verification
   - Return activities with actor email for display
   - Add unit tests
   - Depends on: #1

3. **feat(api): generate activity on todo creation**
   - Extend createTodo to create CREATED activity
   - Activity has no old/new values (just marks creation)
   - Add unit tests
   - Depends on: #2

4. **feat(api): generate activity on todo status change**
   - Extend updateTodo to detect status changes
   - Create STATUS_CHANGED activity with old/new status values
   - Skip activity if status unchanged
   - Add unit tests
   - Depends on: #2

5. **feat(api): generate activity on todo assignee change**
   - Extend updateTodo to detect assignee changes
   - Create ASSIGNEE_CHANGED activity with old/new assigneeId
   - Skip activity if assignee unchanged
   - Add unit tests
   - Depends on: #2

6. **feat(api): generate activity on todo due date change**
   - Extend updateTodo to detect due date changes
   - Create DUE_DATE_CHANGED activity with old/new dates (ISO format)
   - Skip activity if due date unchanged
   - Add unit tests
   - Depends on: #2

7. **feat(api): generate activity on description change**
   - Extend updateTodo to detect description changes
   - Create DESCRIPTION_CHANGED activity (no old/new values stored)
   - Skip activity if description unchanged
   - Add unit tests
   - Depends on: #2

8. **feat(api): generate activity on label changes**
   - Extend addLabelToTodo to create LABELS_CHANGED activity (newValue = label name)
   - Extend removeLabelFromTodo to create LABELS_CHANGED activity (oldValue = label name)
   - Add unit tests
   - Depends on: #2

9. **feat(ui): add ActivityItem component**
   - Create ActivityItem displaying actor initials, message, timestamp
   - Implement getActivityMessage for all action types
   - Format timestamps with date-fns formatDistanceToNow
   - Depends on: #2

10. **feat(ui): add ActivitySection component**
    - Create collapsible ActivitySection
    - Fetch activities on mount
    - Display count in header
    - Collapsed by default
    - Show loading state
    - Depends on: #9

11. **feat(ui): integrate ActivitySection into todo edit dialog**
    - Add ActivitySection to todo edit dialog after subtasks
    - Only show for existing todos (not create dialog)
    - Depends on: #10

12. **test(e2e): add E2E tests for activity log**
    - Test todo creation shows CREATED activity
    - Test status change shows STATUS_CHANGED activity
    - Test assignee change shows ASSIGNEE_CHANGED activity
    - Test due date change shows DUE_DATE_CHANGED activity
    - Test label add shows LABELS_CHANGED activity
    - Test label remove shows LABELS_CHANGED activity
    - Test description change shows DESCRIPTION_CHANGED activity
    - Test activity section is collapsed by default
    - Test activity section shows count
    - Test activities ordered newest first
    - Depends on: #11

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Button, Collapsible)
- Uses lucide-react icons (ChevronDown, ChevronRight)
- Uses date-fns for relative time formatting (formatDistanceToNow)
