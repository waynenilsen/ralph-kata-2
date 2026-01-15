PRD: 0018
Title: Todo Archives
Author: Product
Status: Draft
ERD: [ERD-0018](../erd/0018-todo-archives.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

As users complete tasks, their todo lists become cluttered with completed items. There's no way to hide completed todos without permanently deleting them. Users who want a clean view of active work must either delete completed items (losing history) or scroll past them constantly. Additionally, when users accidentally delete a todo, there's no way to recover it. This lack of archival and recovery capability forces users to choose between a messy interface and losing valuable task history.

**Who has this problem?**

- Power users with high task volume who complete many todos daily/weekly
- Teams who want to retain completed work for reference but not clutter active views
- Users who accidentally delete todos and need to recover them
- Managers reviewing historical work patterns and completed tasks
- Anyone who wants both a clean workspace and a complete historical record

**Why solve it now?**

With activity logs (PRD-0017) now tracking todo changes, users have detailed history of task evolution. However, completed and deleted todos still clutter or disappear from the interface. Archives provide the natural complement to activity logs: a place where completed/deleted work lives without polluting the active workspace. This is standard functionality in mature task management tools (Gmail archive, Todoist completed view, Asana completed tasks section).

---

## Non-Goals

- Automatic archival rules (e.g., "archive after 30 days")
- Archive search (use existing search on archived items)
- Archive organization (folders, categories within archive)
- Permanent deletion from archive (soft delete only for now)
- Archive export (CSV, PDF)
- Per-todo retention policies
- Archiving entire projects/labels at once
- Archive storage limits or quotas
- Archive sharing or permissions different from main todos

---

## Success Criteria

**Quantitative:**
- Users can archive completed todos to remove them from the main view
- Users can view all archived todos in a dedicated archive view
- Users can restore archived todos back to active status
- Deleted todos go to trash instead of permanent deletion
- Users can view and restore todos from trash
- Users can permanently delete todos from trash
- Archive and trash are tenant-scoped (same isolation as active todos)

**Qualitative:**
- Users feel confident archiving without fear of losing data
- The main todo list feels clean and focused on active work
- Recovering accidentally deleted items feels quick and safe
- Archive provides a sense of accomplishment (completed work history)

---

## Solution

**High-level approach**

Add an `archivedAt` timestamp field to the Todo model. Archived todos are excluded from the main view but accessible in a dedicated archive view. Add a separate Trash model or `deletedAt` field for soft-deleted todos. Provide server actions for archive, restore, and permanent delete operations. Add UI for accessing archive and trash views.

**User Stories**

```
When I complete a todo, I want to archive it, so my active list stays focused.

When I need to reference past work, I want to view my archive, so I can see completed tasks.

When I archive something by mistake, I want to restore it, so I can continue working on it.

When I delete a todo, I want it to go to trash first, so I can recover it if needed.

When I'm sure I don't need a deleted todo, I want to permanently delete it, so it's gone forever.
```

**What's in scope**

- `archivedAt` timestamp field on Todo model (null = active, set = archived)
- `deletedAt` timestamp field on Todo model (null = not deleted, set = in trash)
- Archive action: sets archivedAt, removes from active view
- Unarchive action: clears archivedAt, returns to active view
- Soft delete action: sets deletedAt, moves to trash
- Restore from trash action: clears deletedAt, returns to previous state
- Permanent delete action: actually removes todo from database
- Archive view: list of archived todos with restore option
- Trash view: list of deleted todos with restore and permanent delete options
- Navigation to access archive and trash views
- Archived todos excluded from main todo list queries
- Deleted todos excluded from all normal queries (including archive)
- Activity log entries for archive/unarchive actions

**What's out of scope**

- Bulk archive/restore operations
- Auto-archive on completion (manual action only)
- Archive retention policies
- Trash auto-cleanup (e.g., "empty after 30 days")
- Archive/trash counts in navigation
- Filtering within archive view
- Archiving todos with active subtasks (archive parent only, subtasks follow)

---

## Data Model Changes

**Todo Model Additions**
- `archivedAt` - DateTime, nullable, null means active
- `deletedAt` - DateTime, nullable, null means not in trash

**Query Behavior**
- Main todo list: WHERE archivedAt IS NULL AND deletedAt IS NULL
- Archive view: WHERE archivedAt IS NOT NULL AND deletedAt IS NULL
- Trash view: WHERE deletedAt IS NOT NULL

**State Transitions**
```
Active ─── archive ───> Archived
   │                        │
   │                        │ (unarchive)
   │                        v
   │                     Active
   │
   └─── delete ───> Trash ─── restore ───> Active (or Archived if was archived)
                      │
                      └─── permanent delete ───> Gone
```

---

## UI Patterns

**Main Todo List**
- No change to existing UI
- Archived and deleted todos simply don't appear

**Todo Card Actions**
- New "Archive" option in todo card dropdown menu (for completed todos)
- "Delete" option moves to trash (soft delete)

**Archive Action Availability**
- Archive button/option available on all todos (not just completed)
- Users may want to archive abandoned or deferred work
- No restriction based on status

**Navigation**
- New "Archive" link in sidebar/navigation
- New "Trash" link in sidebar/navigation
- Both under a "More" section or similar grouping

**Archive View**
- Similar layout to main todo list
- Header: "Archive"
- Each todo card shows:
  - Same info as main view (title, status, labels, etc.)
  - "Archived on {date}" indicator
  - "Restore" action button
- Empty state: "No archived todos"

**Trash View**
- Similar layout to archive view
- Header: "Trash"
- Each todo card shows:
  - Same info as main view
  - "Deleted on {date}" indicator
  - "Restore" action button
  - "Delete permanently" action button
- Empty state: "Trash is empty"
- Warning on permanent delete: "This cannot be undone"

**Confirmation Dialogs**
- Permanent delete: "Are you sure? This todo will be permanently deleted and cannot be recovered."
- No confirmation needed for archive/unarchive/soft-delete/restore (reversible actions)

---

## Behavior

**Archive**
- Sets archivedAt to current timestamp
- Todo disappears from main list
- Todo appears in archive view
- Activity log entry: "archived this todo"
- Notifications, comments, subtasks remain intact

**Unarchive (Restore from Archive)**
- Clears archivedAt (sets to null)
- Todo reappears in main list
- Todo disappears from archive view
- Activity log entry: "restored this todo from archive"

**Soft Delete**
- Sets deletedAt to current timestamp
- Todo disappears from main list AND archive view
- Todo appears in trash view
- Activity log entry: "moved this todo to trash"
- If todo was archived, archivedAt is preserved (restore goes back to archive)

**Restore from Trash**
- Clears deletedAt (sets to null)
- If archivedAt was set, todo returns to archive view
- If archivedAt was null, todo returns to main list
- Activity log entry: "restored this todo from trash"

**Permanent Delete**
- Removes todo from database entirely
- Cascades to: subtasks, comments, labels, activity log entries
- No activity log entry (todo is gone)
- Notifications referencing this todo show "Todo not found" when clicked

**Edge Cases**
- Recurring todo archived: Next instance still generates (recurrence not affected)
- Todo with subtasks archived: Subtasks archived with parent
- Archived todo's subtask completed: No new recurring instance (parent is archived)
- Delete from archive: Goes to trash with archivedAt preserved
- Search includes archive: Yes, search should include archived (not trash)

---

## Activity Log Integration

New activity types:
- ARCHIVED: "{actor} archived this todo"
- UNARCHIVED: "{actor} restored this todo from archive"
- TRASHED: "{actor} moved this todo to trash"
- RESTORED: "{actor} restored this todo from trash"

---

## Prototype

Implementation will use existing shadcn/ui components. Archive and Trash icons from lucide-react (Archive, Trash2, RotateCcw for restore). Views follow existing todo list patterns.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model
- PRD-0014 (Todo Subtasks) - subtasks follow parent to archive
- PRD-0017 (Todo Activity Log) - activity entries for archive actions
