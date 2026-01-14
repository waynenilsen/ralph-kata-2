PRD: 0009
Title: Due Date Reminders
Author: Product
Status: Draft
ERD: [ERD-0009](../erd/0009-due-date-reminders.md)
Last Updated: 2026-01-14

---

## Problem

**What problem are we solving?**

Users set due dates on todos but have no way to be reminded when deadlines approach. They must manually check the app to see upcoming or overdue tasks. This leads to missed deadlines and reduces the value of the due date feature. Without reminders, due dates are just metadata rather than actionable notifications.

**Who has this problem?**

All users of the multi-tenant todo application who use due dates to manage their work. Particularly users who:
- Have many tasks with different deadlines
- Don't check the app daily
- Need to plan ahead for upcoming work

**Why solve it now?**

The email infrastructure is in place (PRD-0005). Due dates already exist on todos. Connecting these two creates immediate value. Reminders are a standard expectation for any task management application with due dates.

---

## Non-Goals

- Push notifications (requires mobile app or service workers)
- SMS notifications (external service)
- Slack/Teams integrations (external services)
- Custom reminder intervals per todo (complexity)
- Snoozing reminders (complexity)
- In-app notification center (separate feature)
- Recurring reminders for overdue tasks (one reminder is enough)

---

## Success Criteria

**Quantitative:**
- Users receive an email reminder 24 hours before a todo is due
- Users receive an email when a todo becomes overdue (morning of the due date)
- Reminders are only sent for PENDING todos (not COMPLETED)
- Each todo generates at most one "due soon" and one "overdue" reminder
- Users can opt out of reminder emails from their settings
- A scheduled job runs daily to process reminders

**Qualitative:**
- Users feel the due dates are now actionable, not just labels
- Reminder emails are helpful without being spammy
- Users trust that they won't miss deadlines if they set due dates

---

## Solution

**High-level approach**

Add a daily scheduled job that finds todos with upcoming or past due dates and sends reminder emails. Track which reminders have been sent to avoid duplicates. Allow users to opt out of reminders via their account settings.

**User Stories**

```
When I have a todo due tomorrow, I want to receive an email reminder, so I can prepare to complete it.

When a todo's due date passes and it's still incomplete, I want to be notified, so I know I missed a deadline.

When I don't want reminder emails, I want to disable them, so I'm not bothered by notifications.
```

**What's in scope**

- Daily reminder job (runs once per day, e.g., 8am)
- "Due soon" email for todos due within 24-48 hours
- "Overdue" email for todos whose due date has passed
- Reminder tracking to prevent duplicate emails
- User preference to disable reminders
- React Email templates for reminder emails
- E2E test coverage using Mailhog

**What's out of scope**

- Per-todo reminder customization (e.g., remind me 1 week before)
- Multiple reminders for the same todo
- Real-time job execution (cron job runs on schedule)
- Digest emails (one email per todo, not batched)
- Web push notifications
- Reminder history/log UI

---

## Reminder Logic

**Due Soon (24-48 hours before)**
- Query: todos where `dueDate` is between now+24h and now+48h
- Only PENDING status
- Not already reminded (dueSoonReminderSent = false)
- Send email, mark dueSoonReminderSent = true

**Overdue (morning of due date or after)**
- Query: todos where `dueDate` < now AND `dueDate` >= now-24h (within last 24 hours)
- Only PENDING status
- Not already reminded (overdueReminderSent = false)
- Send email, mark overdueReminderSent = true

**Why this approach:**
- Simple to implement and reason about
- No complex interval calculations
- Prevents notification spam
- Clear user expectations

---

## Email Templates

**Due Soon Email**
- Subject: "Reminder: [Todo Title] is due tomorrow"
- Body: Todo title, due date, link to app
- Tone: Helpful, not urgent

**Overdue Email**
- Subject: "Overdue: [Todo Title] was due [date]"
- Body: Todo title, due date, link to app
- Tone: Informative, not alarming

---

## User Preference

Add to user settings (PRD-0008):
- Toggle: "Email reminders for upcoming due dates"
- Default: Enabled
- Stored on User model as `emailRemindersEnabled`

---

## Scheduled Job

The reminder job runs daily. Options for execution:
1. **Manual cron** - External cron calls an API endpoint
2. **Vercel Cron** - If deployed to Vercel
3. **Node-cron** - If running persistent server

For this PRD, implement as an API endpoint (`/api/cron/reminders`) that can be called by any scheduler. Protect with a shared secret in environment variables.

---

## Prototype

Implementation will use existing React Email templates and the email service from PRD-0005.

---

## Dependencies

- PRD-0005 (Email System with Mailhog) - provides email infrastructure
- PRD-0001 (Multi-Tenant Todo) - provides todo model with dueDate
- PRD-0008 (User Profile & Account Settings) - provides settings page for preference toggle
