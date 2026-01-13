ERD: 0001
Title: Multi-Tenant Todo Application
Author: Engineering
Status: Draft
PRD: [PRD-0001](../prd/0001-multi-tenant-todo.md)
Last Updated: 2026-01-13
Reviewers: -

---

## Overview

Technical design for a multi-tenant todo application. Single SQLite database with tenant isolation via application-level filtering. Session-based authentication with email/password.

---

## Background

See [PRD-0001](../prd/0001-multi-tenant-todo.md) for product requirements.

This is a greenfield implementation with no existing systems to integrate.

---

## Goals and Non-Goals

**Goals:**
- Tenant data isolation via `tenantId` filtering on all queries
- Session-based authentication without external providers
- CRUD operations for todos scoped to tenant
- Zero-configuration deployment

**Non-Goals:**
- Real-time updates (WebSockets)
- Full-text search
- Audit logging
- API rate limiting
- Multi-tenant user membership

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
┌─────────────┐     ┌─────────────────┐     ┌─────────┐
│   Browser   │────▶│  Next.js App    │────▶│ SQLite  │
└─────────────┘     │  (App Router)   │     └─────────┘
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │     Prisma      │
                    └─────────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| `app/(auth)/*` | Login, register, logout pages |
| `app/(app)/*` | Authenticated app pages (todos) |
| `app/api/auth/*` | Auth API routes (login, register, logout) |
| `lib/auth.ts` | Session management, password hashing |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/tenant.ts` | Tenant context helpers |

**Data Flow**

1. User authenticates → session created with `userId` and `tenantId`
2. All authenticated requests include session
3. Data access layer reads `tenantId` from session
4. All queries filter by `tenantId`

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | All data queries shall filter by `tenantId` | Must |
| REQ-002 | Passwords shall be hashed with bcrypt (cost 10) | Must |
| REQ-003 | Sessions shall expire after 7 days | Must |
| REQ-004 | Users shall belong to exactly one tenant | Must |
| REQ-005 | Tenant signup shall create tenant + admin user atomically | Must |
| REQ-006 | Todo operations shall validate ownership before mutation | Must |
| REQ-007 | Only ADMINs shall invite new users to a tenant | Must |
| REQ-008 | Invited users shall set password on first login via invite token | Must |

---

## API Design

Using Server Actions for mutations, Server Components for reads.

```typescript
// app/actions/auth.ts
'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { createSession, destroySession } from '@/lib/session';
import { redirect } from 'next/navigation';

export async function register(data: {
  email: string;
  password: string;
  tenantName: string;
}) {
  const hashedPassword = await hashPassword(data.password);

  const tenant = await prisma.tenant.create({
    data: {
      name: data.tenantName,
      users: {
        create: {
          email: data.email,
          passwordHash: hashedPassword,
          role: 'ADMIN',
        },
      },
    },
    include: { users: true },
  });

  await createSession(tenant.users[0].id, tenant.id);
  redirect('/todos');
}

export async function login(data: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
    include: { tenant: true },
  });

  if (!user || !(await verifyPassword(data.password, user.passwordHash))) {
    return { error: 'Invalid credentials' };
  }

  await createSession(user.id, user.tenantId);
  redirect('/todos');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

export async function inviteUser(email: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });
  if (user?.role !== 'ADMIN') throw new Error('Forbidden');

  const token = crypto.randomUUID();
  await prisma.invite.create({
    data: {
      email,
      token,
      tenantId: session.tenantId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // In production, send email. For now, log the invite link.
  console.log(`Invite link: /invite/${token}`);
}

export async function acceptInvite(token: string, password: string) {
  const invite = await prisma.invite.findUnique({
    where: { token },
  });

  if (!invite || invite.expiresAt < new Date()) {
    throw new Error('Invalid or expired invite');
  }

  const hashedPassword = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email: invite.email,
      passwordHash: hashedPassword,
      tenantId: invite.tenantId,
      role: 'MEMBER',
    },
  });

  await prisma.invite.delete({ where: { id: invite.id } });
  await createSession(user.id, user.tenantId);
  redirect('/todos');
}
```

```typescript
// app/actions/todos.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { revalidatePath } from 'next/cache';

export async function createTodo(data: {
  title: string;
  description?: string;
  dueDate?: Date;
}) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await prisma.todo.create({
    data: {
      ...data,
      tenantId: session.tenantId,
      createdById: session.userId,
    },
  });

  revalidatePath('/todos');
}

export async function updateTodo(
  id: string,
  data: { title?: string; description?: string; dueDate?: Date; status?: 'PENDING' | 'COMPLETED' }
) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await prisma.todo.updateMany({
    where: { id, tenantId: session.tenantId },
    data,
  });

  revalidatePath('/todos');
}

export async function deleteTodo(id: string) {
  const session = await getSession();
  if (!session) throw new Error('Unauthorized');

  await prisma.todo.deleteMany({
    where: { id, tenantId: session.tenantId },
  });

  revalidatePath('/todos');
}
```

---

## Data Model

```prisma
// prisma/tenant.prisma
model Tenant {
  id        String   @id @default(cuid())
  name      String
  users     User[]
  todos     Todo[]
  invites   Invite[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```prisma
// prisma/user.prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(MEMBER)
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  tenantId     String
  todos        Todo[]   @relation("CreatedTodos")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

enum Role {
  ADMIN
  MEMBER
}
```

```prisma
// prisma/todo.prisma
model Todo {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TodoStatus @default(PENDING)
  dueDate     DateTime?
  tenant      Tenant     @relation(fields: [tenantId], references: [id])
  tenantId    String
  createdBy   User       @relation("CreatedTodos", fields: [createdById], references: [id])
  createdById String
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([tenantId])
}

enum TodoStatus {
  PENDING
  COMPLETED
}
```

```prisma
// prisma/session.prisma
model Session {
  id        String   @id @default(cuid())
  userId    String
  tenantId  String
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

```prisma
// prisma/invite.prisma
model Invite {
  id        String   @id @default(cuid())
  email     String
  token     String   @unique
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  tenantId  String
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Database per tenant | Strong isolation | Complex deployment, many files | Overkill for this scale |
| JWT tokens | Stateless | Can't revoke, requires secret management | Sessions simpler |
| NextAuth.js | Feature-rich | External dependency patterns | Roll our own is simpler |
| Row-level security | Database-enforced | SQLite doesn't support it | Not available |

---

## Security Considerations

- **Password Storage:** bcrypt with cost factor 10
- **Session Management:** Database-backed sessions with secure HTTP-only cookie containing session ID; 7-day expiration; lookup on every request enables revocation
- **Tenant Isolation:** All queries include `tenantId` filter; use `updateMany`/`deleteMany` with tenant filter to prevent IDOR
- **Deletion:** Hard deletes (no soft delete complexity)
- **Input Validation:** Zod schemas on all inputs
- **CSRF:** Next.js Server Actions handle CSRF automatically

---

## Testing Strategy

- **Unit tests:** `lib/*.test.ts` for auth helpers, tenant utilities
- **Integration tests:** `test/*.test.ts` for database operations
- **E2E tests:** `e2e/*.spec.ts` for full user flows (register, login, CRUD todos)

Key test cases:
- User cannot access todos from another tenant
- Session expiration works correctly
- Atomic tenant + user creation

---

## Deployment

- SQLite database at `prisma/dev.db`
- Sprite persists the database file
- No environment variables required for basic operation
- Optional `SESSION_SECRET` for production (defaults to random on startup)

---

## Dependencies

None — greenfield implementation.
