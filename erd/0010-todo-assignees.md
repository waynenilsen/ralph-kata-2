ERD: 0010
Title: Todo Assignees
Author: Engineering
Status: Draft
PRD: [PRD-0010](../prd/0010-todo-assignees.md)
Last Updated: 2026-01-15
Reviewers: Engineering Team

---

## Overview

This ERD describes the technical implementation of todo assignees. Users will be able to assign todos to any member of their tenant, filter todos by assignee, and view assignee information on todo cards. This extends the existing todo model and filtering infrastructure.

---

## Background

- Todos have a `createdById` field linking to the creator (ERD-0001)
- Filtering infrastructure exists with URL-based state (ERD-0002)
- Users belong to tenants and can be invited as members (ERD-0001)
- The todo list page has filter controls for status and sort order
- shadcn/ui Select component is available for dropdowns

---

## Goals and Non-Goals

**Goals:**
- Add optional assignee field to Todo model
- Enable assigning todos to tenant members during create/edit
- Add assignee filter to existing filter controls
- Display assignee on todo cards
- Maintain URL-based filter state for assignee
- Support "My Todos" and "Unassigned" quick filters

**Non-Goals:**
- Multiple assignees per todo
- Assignment notification emails
- Assignment history/audit trail
- Workload balancing features
- Auto-assignment rules

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
│   Browser   │────▶│   Next.js   │────▶│   Prisma    │
│  (filters)  │     │   Actions   │     │   Query     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                    │
       │            ┌──────┴──────┐       ┌─────┴─────┐
       │            │  Revalidate │       │ SQLite DB │
       │            │    Path     │       └───────────┘
       │            └─────────────┘
       │
       ▼
┌─────────────┐
│  URL State  │
│ ?assignee=  │
└─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|---------------|
| `prisma/todo.prisma` | Extended with `assigneeId` field and relation |
| `prisma/user.prisma` | Extended with `assignedTodos` relation |
| `app/actions/todos.ts` | Updated `createTodo`, `updateTodo` with assignee |
| `app/actions/users.ts` | New `getTenantMembers` action for dropdown |
| `lib/todo-filters.ts` | Extended with assignee filter logic |
| `app/(app)/todos/todo-filters.tsx` | Add assignee filter dropdown |
| `app/(app)/todos/todo-card.tsx` | Display assignee name |
| `app/(app)/todos/create-todo-dialog.tsx` | Add assignee select |
| `app/(app)/todos/edit-todo-dialog.tsx` | Add assignee select |

**Data Flow**

1. User selects assignee filter (My Todos, Unassigned, All, specific user)
2. Filter component updates URL search params (`?assignee=me`)
3. Server component reads params and queries with assignee filter
4. Todo cards render with assignee display
5. Create/edit forms fetch tenant members for dropdown
6. Assignment updates via server action with path revalidation

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Todo model shall have optional `assigneeId` field referencing User | Must |
| REQ-002 | User model shall have `assignedTodos` relation to Todo | Must |
| REQ-003 | Assignee filter shall support values: all, me, unassigned, {userId} | Must |
| REQ-004 | Filter state shall persist in URL as `assignee` query param | Must |
| REQ-005 | Todo cards shall display assignee name or "Unassigned" | Must |
| REQ-006 | Create todo form shall include assignee dropdown | Must |
| REQ-007 | Edit todo form shall include assignee dropdown | Must |
| REQ-008 | Assignee dropdown shall list all tenant members | Must |
| REQ-009 | Any tenant member shall be able to assign/reassign any todo | Must |
| REQ-010 | New todos shall default to unassigned (assigneeId = null) | Must |
| REQ-011 | Assignee queries shall be tenant-scoped for security | Must |
| REQ-012 | Unit tests shall cover assignee filter logic | Should |
| REQ-013 | E2E tests shall verify assignee workflow | Should |

---

## API Design

**Server Actions**

```typescript
// app/actions/todos.ts - Updated
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';

interface CreateTodoInput {
  title: string;
  description?: string;
  dueDate?: Date;
  assigneeId?: string; // NEW
}

export async function createTodo(data: CreateTodoInput) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  // Validate assignee belongs to same tenant
  if (data.assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: data.assigneeId,
        tenantId: session.tenantId,
      },
    });
    if (!assignee) throw new Error('Invalid assignee');
  }

  const todo = await prisma.todo.create({
    data: {
      title: data.title,
      description: data.description,
      dueDate: data.dueDate,
      assigneeId: data.assigneeId, // NEW
      tenantId: session.tenantId,
      createdById: session.userId,
    },
  });

  revalidatePath('/todos');
  return todo;
}

export async function updateTodoAssignee(todoId: string, assigneeId: string | null) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  // Verify todo belongs to tenant
  const todo = await prisma.todo.findFirst({
    where: {
      id: todoId,
      tenantId: session.tenantId,
    },
  });
  if (!todo) throw new Error('Todo not found');

  // Validate assignee if provided
  if (assigneeId) {
    const assignee = await prisma.user.findFirst({
      where: {
        id: assigneeId,
        tenantId: session.tenantId,
      },
    });
    if (!assignee) throw new Error('Invalid assignee');
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { assigneeId },
  });

  revalidatePath('/todos');
}
```

```typescript
// app/actions/users.ts - New action
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function getTenantMembers() {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const members = await prisma.user.findMany({
    where: {
      tenantId: session.tenantId,
    },
    select: {
      id: true,
      email: true,
    },
    orderBy: {
      email: 'asc',
    },
  });

  return members;
}
```

**Filter Logic Extension**

```typescript
// lib/todo-filters.ts - Extended
export type AssigneeFilter = 'all' | 'me' | 'unassigned' | string;

export interface TodoFilters {
  status: 'all' | 'pending' | 'completed';
  sort: 'created-desc' | 'created-asc' | 'due-asc' | 'due-desc';
  assignee: AssigneeFilter; // NEW
}

export function parseFiltersFromSearchParams(
  searchParams: URLSearchParams,
  currentUserId: string
): TodoFilters {
  return {
    status: (searchParams.get('status') as TodoFilters['status']) || 'all',
    sort: (searchParams.get('sort') as TodoFilters['sort']) || 'created-desc',
    assignee: searchParams.get('assignee') || 'all', // NEW
  };
}

export function buildAssigneeWhereClause(
  assignee: AssigneeFilter,
  currentUserId: string
): Prisma.TodoWhereInput {
  switch (assignee) {
    case 'all':
      return {};
    case 'me':
      return { assigneeId: currentUserId };
    case 'unassigned':
      return { assigneeId: null };
    default:
      // Specific user ID
      return { assigneeId: assignee };
  }
}
```

---

## Data Model

**Todo Model Extension**

```prisma
// prisma/todo.prisma
model Todo {
  id                      String     @id @default(cuid())
  title                   String
  description             String?
  status                  TodoStatus @default(PENDING)
  dueDate                 DateTime?
  tenant                  Tenant     @relation(fields: [tenantId], references: [id])
  tenantId                String
  createdBy               User       @relation("CreatedTodos", fields: [createdById], references: [id])
  createdById             String
  assignee                User?      @relation("AssignedTodos", fields: [assigneeId], references: [id])
  assigneeId              String?
  createdAt               DateTime   @default(now())
  updatedAt               DateTime   @updatedAt
  dueSoonReminderSentAt   DateTime?
  overdueReminderSentAt   DateTime?

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, dueDate])
  @@index([tenantId, createdAt])
  @@index([tenantId, assigneeId])
  @@index([dueDate, status, dueSoonReminderSentAt])
  @@index([dueDate, status, overdueReminderSentAt])
}

enum TodoStatus {
  PENDING
  COMPLETED
}
```

**User Model Extension**

```prisma
// prisma/user.prisma
model User {
  id                    String               @id @default(cuid())
  email                 String               @unique
  passwordHash          String
  role                  Role                 @default(MEMBER)
  tenant                Tenant               @relation(fields: [tenantId], references: [id])
  tenantId              String
  todos                 Todo[]               @relation("CreatedTodos")
  assignedTodos         Todo[]               @relation("AssignedTodos")
  sessions              Session[]
  passwordResetTokens   PasswordResetToken[]
  emailRemindersEnabled Boolean              @default(true)
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  @@index([tenantId])
}

enum Role {
  ADMIN
  MEMBER
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Auto-assign to creator | Simpler mental model | Not team-oriented | Doesn't solve delegation |
| Multiple assignees | More flexible | Complex UI, unclear ownership | Single owner preferred |
| Separate assignment model | Full audit trail | Over-engineered | Simple field sufficient |
| Assignment only by admin | Clear hierarchy | Limits collaboration | All members should delegate |

---

## Security Considerations

- Assignee must belong to same tenant (validation in server action)
- User can only view/filter todos within their tenant
- Any tenant member can assign/reassign (no role restriction)
- Assignee dropdown only shows tenant members (tenant-scoped query)
- IDOR prevention: verify todo and assignee belong to user's tenant

---

## Testing Strategy

**Unit tests:**
- Test assignee filter logic with all filter values
- Test assignee validation (same tenant check)
- Test `getTenantMembers` returns correct users

**E2E tests:**
- Create todo with assignee
- Edit todo to change assignee
- Filter by "My Todos" shows only assigned todos
- Filter by "Unassigned" shows only unassigned
- Filter by specific user shows their todos
- Verify assignee displayed on todo card

---

## Deployment

- Run Prisma migration: `bunx prisma db push`
- Existing todos will have `assigneeId = null` (unassigned)
- No data migration required
- No environment variable changes

---

## Open Questions

None - all questions resolved.

---

## Dependencies

- Existing todo model (ERD-0001)
- Existing filter infrastructure (ERD-0002)
- shadcn/ui Select component
