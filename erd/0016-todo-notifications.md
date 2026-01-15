ERD: 0016
Title: Todo Notifications
Author: Engineering
Status: Draft
PRD: [PRD-0016](../prd/0016-todo-notifications.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding in-app notifications. Users receive notifications when assigned to a todo or when someone comments on a todo they created. Notifications appear in a dropdown accessible from the navigation header with an unread count badge.

---

## Background

- PRD-0016 defines the product requirements for in-app notifications
- PRD-0001 established the multi-tenant todo system with User and Todo models
- PRD-0010 added assignees, triggering assignment notifications
- PRD-0011 added comments, triggering comment notifications
- Notifications complete the collaboration loop started with assignees and comments

---

## Goals and Non-Goals

**Goals:**
- Create Notification model linked to User and optionally to Todo
- Generate notifications when a user is assigned to a todo (not self-assignment)
- Generate notifications when someone comments on a user's created todo (not self-comment)
- Display notification bell icon with unread count badge in navigation
- Provide notifications dropdown showing recent notifications
- Allow marking notifications as read (individually and all at once)
- Link notifications to their source todos for direct navigation

**Non-Goals:**
- Push notifications (browser/mobile)
- Email notification digests
- Per-notification-type preferences
- WebSocket real-time updates
- Notification expiration or cleanup
- @mentions in comments
- Notification for todo status changes, label changes, or due date changes

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
│   Assign    │────▶│  Create     │────▶│ Notification│
│   Todo      │     │ Notification│     │   Table     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
┌─────────────┐            │
│   Add       │────────────┘
│  Comment    │
└─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Header    │────▶│   Bell +    │────▶│   Dropdown  │
│   Nav       │     │   Badge     │     │   List      │
└─────────────┘     └─────────────┘     └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Notification model | Stores notification data |
| createNotification helper | Creates notification records |
| getNotifications action | Fetches user's notifications |
| getUnreadCount action | Gets unread notification count |
| markNotificationRead action | Marks single notification as read |
| markAllNotificationsRead action | Marks all notifications as read |
| NotificationBell | Bell icon with unread count badge |
| NotificationDropdown | Dropdown showing notification list |
| NotificationItem | Individual notification display |

**Data Flow**

1. User A assigns User B to a todo
   a. updateTodoAssignee action checks if assignee is different from actor
   b. If different, createNotification called with type TODO_ASSIGNED
   c. Notification stored with userId = B, todoId = todo.id
2. User C comments on User D's todo
   a. createComment action checks if commenter is different from todo creator
   b. If different, createNotification called with type TODO_COMMENTED
   c. Notification stored with userId = D, todoId = todo.id
3. User views notifications:
   a. Header fetches getUnreadCount for badge
   b. User clicks bell, dropdown opens
   c. getNotifications fetches recent notifications
   d. User clicks notification, navigates to todo, notification marked read
   e. Or user clicks "Mark all read"

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Notification model shall have id, userId, type, message, todoId (nullable), isRead, createdAt | Must |
| REQ-002 | Notification type shall be an enum with TODO_ASSIGNED and TODO_COMMENTED | Must |
| REQ-003 | Notifications shall be created when user is assigned to a todo (not self-assignment) | Must |
| REQ-004 | Notifications shall be created when comment is added to user's created todo (not self-comment) | Must |
| REQ-005 | Navigation header shall display bell icon with unread count badge | Must |
| REQ-006 | Clicking bell icon shall open notifications dropdown | Must |
| REQ-007 | Dropdown shall show up to 20 most recent notifications | Must |
| REQ-008 | Each notification shall display icon, message, and relative time | Must |
| REQ-009 | Clicking notification shall mark it as read and navigate to todo | Must |
| REQ-010 | "Mark all read" shall mark all user's notifications as read | Must |
| REQ-011 | Unread notifications shall have visual distinction (bold text, indicator) | Must |
| REQ-012 | Server actions shall verify notification belongs to current user | Must |
| REQ-013 | Notifications table shall be indexed on userId and isRead | Should |
| REQ-014 | Badge shall be hidden when unread count is 0 | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/notifications.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';
import { NotificationType } from '@prisma/client';

export type NotificationActionState = {
  success?: boolean;
  error?: string;
};

// Create a notification (internal helper, not exported as action)
export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  message: string;
  todoId?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: data.userId,
      type: data.type,
      message: data.message,
      todoId: data.todoId,
      isRead: false,
    },
  });
}

// Get notifications for current user
export async function getNotifications(limit: number = 20): Promise<{
  notifications: Array<{
    id: string;
    type: NotificationType;
    message: string;
    todoId: string | null;
    isRead: boolean;
    createdAt: Date;
  }>;
  error?: string;
}> {
  const session = await getSession();
  if (!session) {
    return { notifications: [], error: 'Not authenticated' };
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      type: true,
      message: true,
      todoId: true,
      isRead: true,
      createdAt: true,
    },
  });

  return { notifications };
}

// Get unread notification count
export async function getUnreadNotificationCount(): Promise<number> {
  const session = await getSession();
  if (!session) {
    return 0;
  }

  const count = await prisma.notification.count({
    where: {
      userId: session.user.id,
      isRead: false,
    },
  });

  return count;
}

// Mark single notification as read
export async function markNotificationRead(
  notificationId: string
): Promise<NotificationActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { userId: true },
  });

  if (!notification || notification.userId !== session.user.id) {
    return { error: 'Notification not found' };
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });

  return { success: true };
}

// Mark all notifications as read
export async function markAllNotificationsRead(): Promise<NotificationActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      isRead: false,
    },
    data: { isRead: true },
  });

  return { success: true };
}
```

### Integration with Existing Actions

```typescript
// app/actions/todos.ts - extend updateTodoAssignee
export async function updateTodoAssignee(
  todoId: string,
  assigneeId: string | null
): Promise<TodoActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true, title: true, assigneeId: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  await prisma.todo.update({
    where: { id: todoId },
    data: { assigneeId },
  });

  // Create notification if assigning to someone else (not self-assignment)
  if (assigneeId && assigneeId !== session.user.id && assigneeId !== todo.assigneeId) {
    const assigner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    await createNotification({
      userId: assigneeId,
      type: 'TODO_ASSIGNED',
      message: `${assigner?.email ?? 'Someone'} assigned you to "${todo.title}"`,
      todoId,
    });
  }

  revalidatePath('/todos');
  return { success: true };
}

// app/actions/comments.ts - extend createComment
export async function createComment(data: {
  todoId: string;
  content: string;
}): Promise<CommentActionState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const todo = await prisma.todo.findUnique({
    where: { id: data.todoId },
    select: { tenantId: true, title: true, createdById: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  const comment = await prisma.comment.create({
    data: {
      content: data.content,
      todoId: data.todoId,
      authorId: session.user.id,
    },
  });

  // Create notification if commenting on someone else's todo (not self-comment)
  if (todo.createdById !== session.user.id) {
    const commenter = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    await createNotification({
      userId: todo.createdById,
      type: 'TODO_COMMENTED',
      message: `${commenter?.email ?? 'Someone'} commented on "${todo.title}"`,
      todoId: data.todoId,
    });
  }

  revalidatePath('/todos');
  return { success: true, comment };
}
```

---

## Data Model

### Prisma Enum

```prisma
// prisma/schema.prisma - add enum
enum NotificationType {
  TODO_ASSIGNED
  TODO_COMMENTED
}
```

### Notification Model

```prisma
// prisma/notification.prisma
model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      NotificationType
  message   String
  todoId    String?
  todo      Todo?            @relation(fields: [todoId], references: [id], onDelete: SetNull)
  isRead    Boolean          @default(false)
  createdAt DateTime         @default(now())

  @@index([userId, isRead])
  @@index([userId, createdAt])
}
```

### Model Updates

```prisma
// prisma/user.prisma - add relation
model User {
  // ... existing fields ...
  notifications Notification[]
}

// prisma/todo.prisma - add relation
model Todo {
  // ... existing fields ...
  notifications Notification[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### NotificationBell

```typescript
// app/components/notification-bell.tsx
'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { NotificationDropdown } from './notification-dropdown';
import { getUnreadNotificationCount } from '@/app/actions/notifications';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Fetch initial count
    getUnreadNotificationCount().then(setUnreadCount);
  }, []);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Refresh count when closing
      getUnreadNotificationCount().then(setUnreadCount);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <NotificationDropdown onNotificationRead={() => {
          getUnreadNotificationCount().then(setUnreadCount);
        }} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### NotificationDropdown

```typescript
// app/components/notification-dropdown.tsx
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/app/actions/notifications';
import { NotificationType } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';

type Notification = {
  id: string;
  type: NotificationType;
  message: string;
  todoId: string | null;
  isRead: boolean;
  createdAt: Date;
};

type NotificationDropdownProps = {
  onNotificationRead?: () => void;
};

export function NotificationDropdown({ onNotificationRead }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    getNotifications().then((result) => {
      if (result.notifications) {
        setNotifications(result.notifications);
      }
      setLoading(false);
    });
  }, []);

  const handleNotificationClick = (notification: Notification) => {
    startTransition(async () => {
      if (!notification.isRead) {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
        );
        onNotificationRead?.();
      }
      if (notification.todoId) {
        router.push(`/todos?highlight=${notification.todoId}`);
      }
    });
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      onNotificationRead?.();
    });
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'TODO_ASSIGNED':
        return <User className="h-4 w-4" />;
      case 'TODO_COMMENTED':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Notifications</h3>
        {notifications.some((n) => !n.isRead) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
          >
            Mark all read
          </Button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full flex items-start gap-3 p-3 hover:bg-muted text-left transition-colors ${
                !notification.isRead ? 'bg-muted/50' : ''
              }`}
              disabled={isPending}
            >
              <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${!notification.isRead ? 'font-medium' : ''}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              {!notification.isRead && (
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

### Header Integration

```typescript
// In app/(app)/layout.tsx or header component
import { NotificationBell } from '@/app/components/notification-bell';

// Add NotificationBell to header navigation, typically near user menu
<div className="flex items-center gap-2">
  <NotificationBell />
  <UserMenu />
</div>
```

---

## Notification Generation Rules

**TODO_ASSIGNED**
- Trigger: Todo.assigneeId updated to a user
- Condition: New assignee is different from the actor (no self-assignment notification)
- Condition: New assignee is different from previous assignee (no duplicate notification)
- Recipient: The new assignee
- Message format: `"{assigner.email} assigned you to "{todo.title}""`

**TODO_COMMENTED**
- Trigger: New Comment created on a Todo
- Condition: Comment author is different from todo creator (no self-comment notification)
- Recipient: The todo creator (createdById)
- Message format: `"{commenter.email} commented on "{todo.title}""`

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| WebSocket real-time | Instant updates | Complex setup, connection management | Polling/refresh sufficient for MVP |
| Push notifications | Works in background | Requires service worker, permissions | Browser support varies, complex |
| Email notifications | Always delivered | Requires email service | Email reminders already exist for due dates |
| Notification service | Scalable, queued | Over-engineered | Direct DB writes sufficient |

---

## Security Considerations

- **Authorization**: All actions verify notification.userId matches session.user.id
- **No cross-user access**: Users can only view/modify their own notifications
- **Input validation**: NotificationType is an enum, invalid values rejected
- **Message sanitization**: Messages constructed server-side from trusted data
- **Todo link validation**: If todo is deleted, todoId becomes null (SetNull)

---

## Testing Strategy

**Unit Tests**
- createNotification: creates notification with correct fields
- getNotifications: returns only current user's notifications, ordered by createdAt desc
- getUnreadNotificationCount: counts only unread notifications for current user
- markNotificationRead: marks single notification, rejects if wrong user
- markAllNotificationsRead: marks all user's notifications
- updateTodoAssignee: creates notification for non-self assignment
- createComment: creates notification for non-self comment

**E2E Tests**
- Assigning todo to another user creates notification for assignee
- Self-assignment does not create notification
- Commenting on another user's todo creates notification for creator
- Self-comment does not create notification
- Bell icon shows correct unread count
- Clicking bell opens dropdown with notifications
- Clicking notification marks as read and navigates to todo
- "Mark all read" marks all notifications as read
- Unread notifications have visual indicator
- Empty state shows when no notifications

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

Uses date-fns for relative time formatting (formatDistanceToNow).

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add Notification model and NotificationType enum**
   - Add NotificationType enum (TODO_ASSIGNED, TODO_COMMENTED)
   - Create Notification model with userId, type, message, todoId, isRead, createdAt
   - Add relation to User model
   - Add relation to Todo model (optional, onDelete: SetNull)
   - Add indexes on (userId, isRead) and (userId, createdAt)
   - Run migration
   - Depends on: None

2. **feat(api): add notification server actions**
   - Implement createNotification helper function
   - Implement getNotifications action (returns recent 20, ordered by createdAt desc)
   - Implement getUnreadNotificationCount action
   - Implement markNotificationRead action with user verification
   - Implement markAllNotificationsRead action
   - Add unit tests
   - Depends on: #1

3. **feat(api): generate notifications on todo assignment**
   - Extend updateTodoAssignee to create notification
   - Skip notification for self-assignment
   - Skip notification if assignee unchanged
   - Include assigner email and todo title in message
   - Add unit tests
   - Depends on: #2

4. **feat(api): generate notifications on comment creation**
   - Extend createComment to create notification
   - Skip notification for self-comment (commenter is todo creator)
   - Include commenter email and todo title in message
   - Add unit tests
   - Depends on: #2

5. **feat(ui): add NotificationBell component**
   - Create NotificationBell with bell icon
   - Fetch and display unread count as badge
   - Hide badge when count is 0
   - Open dropdown on click
   - Depends on: #2

6. **feat(ui): add NotificationDropdown component**
   - Create NotificationDropdown showing notification list
   - Display icon based on notification type
   - Display message and relative time
   - Visual distinction for unread (bold, blue dot)
   - "Mark all read" button
   - Empty state when no notifications
   - Depends on: #5

7. **feat(ui): add notification click actions**
   - Click notification marks as read
   - Click notification navigates to todo
   - Refresh unread count after actions
   - Handle deleted todos gracefully
   - Depends on: #6

8. **feat(ui): integrate NotificationBell into header**
   - Add NotificationBell to app layout header
   - Position near user menu
   - Depends on: #5

9. **test(e2e): add E2E tests for notifications**
   - Test assignment creates notification
   - Test self-assignment does not create notification
   - Test comment creates notification
   - Test self-comment does not create notification
   - Test bell shows unread count
   - Test dropdown displays notifications
   - Test click marks as read
   - Test navigation to todo
   - Test mark all read
   - Test empty state
   - Depends on: #7, #8

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Button, Badge, DropdownMenu)
- Uses lucide-react icons (Bell, User, MessageSquare)
- Uses date-fns for relative time formatting (formatDistanceToNow)
