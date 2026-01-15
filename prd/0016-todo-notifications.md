PRD: 0016
Title: Todo Notifications
Author: Product
Status: Draft
ERD: [ERD-0016](../erd/0016-todo-notifications.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Users have no way to know when something relevant happens in the application. When assigned a todo, they must manually check their todo list. When someone comments on their todo, they only see it when they happen to open that todo. When a todo they're watching gets updated, they're unaware. This lack of visibility leads to missed assignments, delayed responses to comments, and poor team coordination.

**Who has this problem?**

- Team members who get assigned todos and need to know immediately
- Todo creators who want to know when teammates comment on their tasks
- Users following the progress of specific todos
- Team leads who need awareness of activity on their team's tasks

**Why solve it now?**

The application now has assignees (PRD-0010), comments (PRD-0011), and recurring todos (PRD-0015). These features create events that users need to know about. Without notifications, users must constantly poll the interface manually. In-app notifications are essential for any collaborative task management tool and complete the team collaboration loop started with assignees and comments.

---

## Non-Goals

- Push notifications (browser/mobile push notifications)
- Email digests of notifications (email reminders already exist for due dates)
- Custom notification preferences per todo (global settings only)
- Notification sounds
- Desktop notifications
- Slack/Teams/Discord integrations
- Notification grouping or batching
- Real-time WebSocket notifications (polling or page refresh is sufficient)
- Notification expiration or auto-cleanup
- @mentions in comments (separate feature)

---

## Success Criteria

**Quantitative:**
- Users receive in-app notifications when assigned a todo
- Users receive in-app notifications when someone comments on their created todo
- Users can view all their notifications in a dedicated notifications panel
- Users can mark notifications as read (individually or all at once)
- Unread notification count shows in the header/navigation
- Notifications link directly to the relevant todo

**Qualitative:**
- Users feel informed about activity relevant to them
- Checking notifications feels quick and non-disruptive
- Notification volume feels manageable, not overwhelming

---

## Solution

**High-level approach**

Create a Notification model storing events relevant to each user. Generate notifications on specific actions (assignment, comment). Display a notification bell icon with unread count in the navigation. Provide a dropdown or panel to view and manage notifications. Each notification links to the source todo.

**User Stories**

```
When I'm assigned a todo, I want to be notified, so I know I have new work.

When someone comments on my todo, I want to be notified, so I can respond promptly.

When I have unread notifications, I want to see a count, so I know to check them.

When I click a notification, I want to go to the relevant todo, so I can take action.

When I've read my notifications, I want to mark them as read, so I know what's new.
```

**What's in scope**

- Notification model (id, userId, type, message, todoId, isRead, createdAt)
- Notification types: TODO_ASSIGNED, TODO_COMMENTED
- Notification bell icon in navigation header
- Unread notification count badge
- Notifications dropdown/panel showing recent notifications
- Mark individual notification as read
- Mark all notifications as read
- Click notification to navigate to todo
- Notifications scoped to current user only
- Notification created when: user is assigned a todo (not self-assignment), comment added to user's created todo (not self-comment)
- Server actions for marking read and fetching notifications

**What's out of scope**

- Notification settings/preferences (all notifications enabled by default)
- Notification for todo status changes
- Notification for label changes
- Notification for subtask completion
- Notification for due date changes
- Notification when recurring todo generates new instance
- Full notification history page (dropdown shows recent only)
- Notification search
- Notification filtering by type
- Bulk delete notifications

---

## Notification Types

| Type | Trigger | Message Template |
|------|---------|------------------|
| TODO_ASSIGNED | User assigned to todo (not self) | "{assigner} assigned you to '{todoTitle}'" |
| TODO_COMMENTED | Comment on user's created todo (not self) | "{commenter} commented on '{todoTitle}'" |

**Future types (not in scope):**
- TODO_DUE_SOON - covered by email reminders
- TODO_MENTIONED - requires @mention feature
- TODO_COMPLETED - assignee's todo marked complete

---

## UI Patterns

**Navigation Header**
- Bell icon (lucide-react Bell)
- Badge with unread count (e.g., "3") if > 0
- Badge hidden if count is 0
- Click opens notifications dropdown

**Notifications Dropdown**
- Header: "Notifications" with "Mark all read" link
- List of recent notifications (last 20)
- Each notification shows:
  - Icon based on type (user icon for assignment, message icon for comment)
  - Message text
  - Relative time ("2 hours ago")
  - Unread indicator (dot or bold text)
- Click notification: navigate to todo, mark as read
- Empty state: "No notifications"
- "View all" link (optional, for future full page)

**Notification Item States**
- Unread: bold text, blue dot indicator
- Read: normal text, no indicator

**Interaction**
- Opening dropdown does NOT auto-mark as read
- Clicking a notification marks it as read
- "Mark all read" marks all as read without navigation

---

## Data Model

**Notification**
- `id` - unique identifier (cuid)
- `userId` - recipient of notification (foreign key to User)
- `type` - notification type enum (TODO_ASSIGNED, TODO_COMMENTED)
- `message` - display message text
- `todoId` - related todo (foreign key, nullable if todo deleted)
- `isRead` - boolean, default false
- `createdAt` - timestamp

Notifications are NOT deleted when todo is deleted (preserve history, but link becomes invalid).

---

## Notification Generation Rules

**TODO_ASSIGNED**
- Triggered when: Todo.assigneeId changes to a user
- NOT triggered when: User assigns todo to themselves
- Recipient: The new assignee
- Created by: Server action that updates assignee

**TODO_COMMENTED**
- Triggered when: New comment added to a todo
- NOT triggered when: Todo creator comments on their own todo
- Recipient: The todo creator (createdById)
- Created by: Server action that creates comment

**Edge Cases**
- Assigning to same user again: No new notification
- Commenter is also the todo creator: No notification
- Todo deleted after notification created: Notification remains, clicking shows "Todo not found"
- User reassigned (A → B → A): New notification each time

---

## Performance Considerations

- Index notifications by userId and isRead for fast queries
- Limit dropdown to 20 most recent notifications
- Count query for unread badge (SELECT COUNT with userId + isRead=false)
- Notifications fetched on dropdown open (not on every page load)
- Consider pagination for future "View all" page

---

## Prototype

Implementation will use existing shadcn/ui components (DropdownMenu, Badge, Button). Bell icon from lucide-react. Relative time formatting with date-fns or simple utility.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides user and todo models
- PRD-0010 (Todo Assignees) - assignment triggers notifications
- PRD-0011 (Todo Comments) - comments trigger notifications
