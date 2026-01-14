ERD: 0009
Title: Due Date Reminders
Author: Engineering
Status: Draft
PRD: [PRD-0009](../prd/0009-due-date-reminders.md)
Last Updated: 2026-01-14
Reviewers: Engineering Team

---

## Overview

This ERD describes the technical implementation of due date reminder emails for todos. Users will receive email notifications when todos are approaching their due date (24-48 hours before) and when todos become overdue. The system uses a scheduled API endpoint that can be triggered by any external scheduler.

---

## Background

- Todos already have a `dueDate` field (ERD-0001)
- Email infrastructure exists via Nodemailer and Mailhog (ERD-0005)
- React Email templates are used for transactional emails
- Users have no way to be notified of upcoming or overdue tasks
- PRD-0008 establishes the user settings page where preferences can be added

---

## Goals and Non-Goals

**Goals:**
- Send reminder emails for todos due within 24-48 hours
- Send overdue notifications for todos past their due date
- Track reminder state to prevent duplicate emails
- Allow users to opt out of reminder emails
- Create reusable reminder API endpoint callable by any scheduler
- E2E test coverage using Mailhog

**Non-Goals:**
- Real-time push notifications
- Per-todo custom reminder intervals
- Batching multiple todos into digest emails
- In-app notification UI
- Multiple reminders for the same status
- Recurring reminders for persistently overdue todos

---

## Constraints Checklist

- [x] Uses SQLite (not Postgres, MySQL, etc.)
- [x] No external authentication services
- [x] No external database services
- [x] No external storage services
- [x] No external email services - uses existing Mailhog setup
- [x] Runs on checkout without configuration

---

## Architecture

**System Design**

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Scheduler │────▶│  /api/cron  │────▶│   Prisma    │
│  (external) │     │  /reminders │     │   Query     │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          │              ┌─────┴─────┐
                          │              │ SQLite DB │
                          │              └───────────┘
                          ▼
                    ┌─────────────┐
                    │ Email Loop  │
                    │ per Todo    │
                    └─────────────┘
                          │
                          ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  Nodemailer │────▶│   Mailhog   │
                    │             │     │   :44321    │
                    └─────────────┘     └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|---------------|
| `prisma/todo.prisma` | Extended with reminder tracking fields |
| `prisma/user.prisma` | Extended with `emailRemindersEnabled` preference |
| `app/api/cron/reminders/route.ts` | API endpoint to process reminders |
| `lib/email/templates/due-soon.tsx` | Email template for upcoming due date |
| `lib/email/templates/overdue.tsx` | Email template for overdue todos |
| `lib/reminders.ts` | Reminder processing logic |
| `e2e/reminders.e2e.ts` | E2E tests for reminder flow |

**Data Flow**

1. External scheduler calls `POST /api/cron/reminders` with auth header
2. Endpoint validates CRON_SECRET environment variable
3. Query todos with due dates in reminder windows
4. Filter for users with `emailRemindersEnabled = true`
5. For each eligible todo, send appropriate email template
6. Update todo with reminder sent timestamp
7. Return summary of emails sent

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Todo model shall have `dueSoonReminderSentAt` nullable DateTime field | Must |
| REQ-002 | Todo model shall have `overdueReminderSentAt` nullable DateTime field | Must |
| REQ-003 | User model shall have `emailRemindersEnabled` boolean field, default true | Must |
| REQ-004 | API endpoint shall be protected by CRON_SECRET environment variable | Must |
| REQ-005 | Due soon reminder shall be sent for todos due within 24-48 hours | Must |
| REQ-006 | Overdue reminder shall be sent for todos overdue within past 24 hours | Must |
| REQ-007 | Reminders shall only be sent for PENDING todos | Must |
| REQ-008 | Reminders shall only be sent once per todo per type | Must |
| REQ-009 | Reminders shall respect user opt-out preference | Must |
| REQ-010 | E2E tests shall verify email delivery via Mailhog | Must |
| REQ-011 | Endpoint shall return count of emails sent | Should |

---

## API Design

**Cron Endpoint**

```typescript
// app/api/cron/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processReminders } from '@/lib/reminders';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processReminders();

  return NextResponse.json({
    success: true,
    dueSoonSent: result.dueSoonCount,
    overdueSent: result.overdueCount,
  });
}
```

**Reminder Processing Logic**

```typescript
// lib/reminders.ts
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/send';
import { DueSoonEmail } from '@/lib/email/templates/due-soon';
import { OverdueEmail } from '@/lib/email/templates/overdue';

export async function processReminders() {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Due soon: dueDate is between 24-48 hours from now
  const dueSoonTodos = await prisma.todo.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: in24Hours,
        lt: in48Hours,
      },
      dueSoonReminderSentAt: null,
      createdBy: {
        emailRemindersEnabled: true,
      },
    },
    include: {
      createdBy: true,
    },
  });

  // Overdue: dueDate is in the past 24 hours
  const overdueTodos = await prisma.todo.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: past24Hours,
        lt: now,
      },
      overdueReminderSentAt: null,
      createdBy: {
        emailRemindersEnabled: true,
      },
    },
    include: {
      createdBy: true,
    },
  });

  let dueSoonCount = 0;
  let overdueCount = 0;

  // Send due soon reminders
  for (const todo of dueSoonTodos) {
    await sendEmail({
      to: todo.createdBy.email,
      subject: `Reminder: ${todo.title} is due tomorrow`,
      template: DueSoonEmail({ todo }),
    });

    await prisma.todo.update({
      where: { id: todo.id },
      data: { dueSoonReminderSentAt: now },
    });

    dueSoonCount++;
  }

  // Send overdue reminders
  for (const todo of overdueTodos) {
    await sendEmail({
      to: todo.createdBy.email,
      subject: `Overdue: ${todo.title} was due ${formatDate(todo.dueDate)}`,
      template: OverdueEmail({ todo }),
    });

    await prisma.todo.update({
      where: { id: todo.id },
      data: { overdueReminderSentAt: now },
    });

    overdueCount++;
  }

  return { dueSoonCount, overdueCount };
}
```

**Email Templates**

```typescript
// lib/email/templates/due-soon.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Link,
} from '@react-email/components';

interface DueSoonEmailProps {
  todo: {
    title: string;
    dueDate: Date | null;
    description: string | null;
  };
}

export function DueSoonEmail({ todo }: DueSoonEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container>
          <Heading>Reminder: Task Due Tomorrow</Heading>
          <Text>
            Your task <strong>{todo.title}</strong> is due tomorrow
            {todo.dueDate && ` (${formatDate(todo.dueDate)})`}.
          </Text>
          {todo.description && (
            <Text style={{ color: '#666' }}>{todo.description}</Text>
          )}
          <Link href={`${appUrl}/todos`}>View your tasks</Link>
        </Container>
      </Body>
    </Html>
  );
}
```

```typescript
// lib/email/templates/overdue.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Link,
} from '@react-email/components';

interface OverdueEmailProps {
  todo: {
    title: string;
    dueDate: Date | null;
    description: string | null;
  };
}

export function OverdueEmail({ todo }: OverdueEmailProps) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'sans-serif' }}>
        <Container>
          <Heading>Overdue Task</Heading>
          <Text>
            Your task <strong>{todo.title}</strong> was due
            {todo.dueDate && ` on ${formatDate(todo.dueDate)}`} and is now overdue.
          </Text>
          {todo.description && (
            <Text style={{ color: '#666' }}>{todo.description}</Text>
          )}
          <Link href={`${appUrl}/todos`}>View your tasks</Link>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## Data Model

**Todo Model Extension**

```prisma
// prisma/todo.prisma
model Todo {
  id                     String     @id @default(cuid())
  title                  String
  description            String?
  status                 TodoStatus @default(PENDING)
  dueDate                DateTime?
  dueSoonReminderSentAt  DateTime?
  overdueReminderSentAt  DateTime?
  tenant                 Tenant     @relation(fields: [tenantId], references: [id])
  tenantId               String
  createdBy              User       @relation("CreatedTodos", fields: [createdById], references: [id])
  createdById            String
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt

  @@index([tenantId])
  @@index([tenantId, status])
  @@index([tenantId, dueDate])
  @@index([tenantId, createdAt])
  @@index([dueDate, status, dueSoonReminderSentAt])
  @@index([dueDate, status, overdueReminderSentAt])
}
```

**User Model Extension**

```prisma
// prisma/user.prisma
model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  passwordHash          String
  role                  Role      @default(MEMBER)
  emailRemindersEnabled Boolean   @default(true)
  tenant                Tenant    @relation(fields: [tenantId], references: [id])
  tenantId              String
  todos                 Todo[]    @relation("CreatedTodos")
  sessions              Session[]
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([tenantId])
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Background job queue (Bull/BullMQ) | Reliable scheduling | Requires Redis | External dependency |
| Vercel Cron | Built-in scheduling | Vendor lock-in | Not all deployments use Vercel |
| node-cron in-process | Simple | Requires persistent server | Doesn't work with serverless |
| Digest emails | Fewer emails | More complex logic | Simplicity preferred |

---

## Security Considerations

- Cron endpoint protected by CRON_SECRET header
- Secret should be strong random value (32+ characters)
- Endpoint should not expose sensitive user data in response
- Email content should not include sensitive todo details beyond title
- Rate limiting not required as endpoint is called by trusted scheduler

---

## Testing Strategy

- **Unit tests:**
  - Test reminder query logic with various date scenarios
  - Test email template rendering
  - Test user preference filtering

- **E2E tests:**
  - Create todo with due date in reminder window
  - Call reminder endpoint
  - Verify email received via Mailhog API
  - Verify reminder sent timestamp updated
  - Test opt-out preference prevents email

---

## Deployment

- Set CRON_SECRET environment variable
- Configure external scheduler (cron, Vercel, GitHub Actions) to call endpoint daily
- Example cron: `0 8 * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.example.com/api/cron/reminders`

---

## Open Questions

None - all questions resolved.

---

## Dependencies

- Existing email infrastructure (ERD-0005)
- Existing todo model (ERD-0001)
- Existing user settings page (ERD-0008, if implemented)
