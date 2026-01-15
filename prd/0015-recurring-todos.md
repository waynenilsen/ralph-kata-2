PRD: 0015
Title: Recurring Todos
Author: Product
Status: Draft
ERD: [ERD-0015](../erd/0015-recurring-todos.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Many tasks repeat on a regular schedule: weekly team standups, monthly reports, quarterly reviews, daily check-ins. Users must manually recreate these todos each time or set them up far in advance, cluttering their todo list. There's no way to define a task once and have it automatically regenerate after completion or on a schedule. This creates friction and leads to forgotten recurring obligations.

**Who has this problem?**

- Users with regular recurring responsibilities (weekly reports, daily reviews)
- Team leads who need to ensure recurring team processes happen (standups, retrospectives)
- Anyone who uses the app for habit tracking or routine tasks
- Teams with periodic deadlines (monthly billing, quarterly planning)

**Why solve it now?**

The todo system is now feature-complete for one-time tasks: search (PRD-0013), labels (PRD-0012), comments (PRD-0011), subtasks (PRD-0014), assignees (PRD-0010), and due date reminders (PRD-0009). Recurring tasks are the natural extension to handle ongoing work patterns. This is a standard feature in every major task management tool (Todoist, Asana, Things, TickTick).

---

## Non-Goals

- Complex recurrence patterns (e.g., "third Tuesday of every month")
- Recurring subtask templates (subtasks are recreated manually if needed)
- Automatic assignment rotation (same assignee for all instances)
- Recurring task chains or dependencies
- Skipping occurrences without completing them
- Backdated task generation (only generate going forward)
- Multiple recurrence schedules per todo (one schedule per todo)
- Editing recurrence on existing instances (modify the parent only)
- Calendar integrations (iCal export, Google Calendar sync)
- Time-of-day scheduling (date-based, not time-based)

---

## Success Criteria

**Quantitative:**
- Users can enable recurrence on any todo with a due date
- Users can choose from preset intervals: daily, weekly, biweekly, monthly, yearly
- When a recurring todo is completed, a new instance is automatically created
- New instances have the same properties (title, description, labels, assignee) as the original
- New instance due date is calculated based on the recurrence interval
- Users can disable recurrence to stop future instances
- Users can view and edit the recurrence pattern from the todo edit dialog
- Recurring todos are visually distinguished in the todo list

**Qualitative:**
- Setting up recurring tasks feels quick and intuitive
- Users trust that recurring tasks will regenerate reliably
- Managing recurring patterns doesn't require navigating to a separate screen

---

## Solution

**High-level approach**

Add recurrence fields to the Todo model (recurrenceType, recurrenceInterval). When a recurring todo is marked complete, a server action generates the next instance with an updated due date. Display a recurrence indicator on todo cards. Allow editing recurrence settings in the todo edit dialog.

**User Stories**

```
When I have a weekly task, I want to set it as recurring, so I don't have to recreate it every week.

When I complete a recurring todo, I want the next instance created automatically, so I never forget upcoming occurrences.

When I view my todo list, I want to see which tasks are recurring, so I understand my ongoing commitments.

When a recurring task is no longer needed, I want to disable recurrence, so no future instances are created.
```

**What's in scope**

- Recurrence type field on Todo model (none, daily, weekly, biweekly, monthly, yearly)
- Recurrence settings in todo create/edit dialog
- Visual indicator on todo cards showing recurrence (e.g., "Repeats weekly")
- Auto-generation of next instance when recurring todo is completed
- New instance inherits: title, description, labels, assignee, recurrence settings
- New instance due date calculated from original due date + interval
- Server action to toggle/modify recurrence
- Disabling recurrence stops future auto-generation
- Completing a non-recurring instance (generated from recurring) does NOT create more instances unless it also has recurrence enabled

**What's out of scope**

- Custom recurrence intervals (e.g., every 3 days)
- End date for recurrence (manual disable only)
- Viewing all future occurrences in advance
- Bulk editing recurrence across multiple todos
- Recurrence analytics or patterns
- Comment/subtask inheritance to new instances

---

## UI Patterns

**Todo Card**
- Small repeat icon (circular arrows) displayed if todo has recurrence enabled
- Optional text like "Weekly" beside the icon
- Positioned near other metadata (labels, comments count, subtask progress)

**Todo Create/Edit Dialog**
- "Repeat" dropdown/toggle in the form, near the due date field
- Options: Never, Daily, Weekly, Biweekly, Monthly, Yearly
- Only enabled when a due date is set
- If no due date, show "Set a due date to enable recurrence" helper text
- When recurrence is enabled, show a summary: "Repeats weekly"

**Recurrence Intervals**

| Option | Interval |
|--------|----------|
| Daily | Every 1 day |
| Weekly | Every 7 days |
| Biweekly | Every 14 days |
| Monthly | Same day next month |
| Yearly | Same day next year |

For monthly/yearly, handle edge cases:
- Jan 31 + 1 month = Feb 28/29 (last day of month)
- Feb 29 + 1 year = Feb 28 (non-leap year)

---

## Generation Behavior

**When to generate the next instance:**
- Only when the current instance is marked as COMPLETED
- Not on a schedule/cron job (completion-triggered)

**What the new instance looks like:**
- Same title as original
- Same description as original
- Same labels attached
- Same assignee (if any)
- Same recurrence settings (it will also be recurring)
- Status: PENDING
- Due date: calculated from original due date + interval
- NOT a copy of: comments, subtasks, completion state

**Due date calculation:**
- New due date = original due date + interval
- NOT based on completion date (predictable scheduling)
- Example: Weekly todo due Jan 15, completed Jan 17 → next instance due Jan 22 (not Jan 24)

---

## Edge Cases

**Todo completed after due date:**
- Still generate next instance based on original due date
- Example: Due Jan 15, completed Jan 20 → next due Jan 22 (if weekly)

**Todo without due date:**
- Cannot enable recurrence
- UI shows "Set a due date first"

**Due date removed from recurring todo:**
- Recurrence is automatically disabled
- Warning shown to user

**Recurring todo deleted:**
- No future instances generated
- Existing instances remain (they're independent)

**User changes recurrence interval:**
- Takes effect on next completion
- Current instance keeps its due date

---

## Prototype

Implementation will use existing shadcn/ui components (Select for recurrence dropdown). The repeat icon can use lucide-react's Repeat or RefreshCw icon.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model with due date
- PRD-0012 (Todo Labels) - labels are copied to new instances
- PRD-0010 (Todo Assignees) - assignee is copied to new instances
