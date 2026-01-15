PRD: 0011
Title: Todo Comments
Author: Product
Status: Draft
ERD: [ERD-0011](../erd/0011-todo-comments.md)
Last Updated: 2026-01-15

---

## Problem

**What problem are we solving?**

Team members cannot discuss or provide context on todos within the application. When questions arise about a task, updates need to be shared, or decisions need to be documented, users must communicate through external channels (Slack, email, meetings). This context lives outside the task, making it hard to understand the full history of a todo. New team members lack visibility into past discussions.

**Who has this problem?**

- Team members collaborating on shared tasks who need to ask questions or provide updates
- Assignees who need clarification on task requirements
- Todo creators who want to add context or respond to questions
- Team leads reviewing task progress and understanding blockers
- New team members trying to understand the history of ongoing work

**Why solve it now?**

With assignees now implemented (PRD-0010), teams can delegate work. The natural next step is enabling communication about that delegated work. Comments are a standard feature of every task management tool and a fundamental expectation for team collaboration.

---

## Non-Goals

- Threaded replies or nested comments (flat list keeps it simple)
- @mentions with notifications (future PRD can add this)
- Rich text formatting (markdown support is sufficient)
- File attachments on comments (no file storage infrastructure)
- Comment editing or deletion (append-only history)
- Real-time comment updates (page refresh shows new comments)
- Comment reactions/emoji (complexity without clear value)
- Email notifications for new comments (future PRD can add this)

---

## Success Criteria

**Quantitative:**
- Users can add comments to any todo in their tenant
- Comments display author, timestamp, and content
- Comments are ordered chronologically (oldest first)
- Comment count is visible on todo cards without opening details
- Comments load with the todo detail view (no separate fetch)

**Qualitative:**
- Adding a comment feels quick and natural
- Reading comment history provides clear context
- Team collaboration on tasks happens within the app

---

## Solution

**High-level approach**

Add a Comment model linked to Todo and User. Display comments in the todo edit dialog below the form fields. Provide a simple text input for adding new comments. Show comment count on todo cards as a visual indicator.

**User Stories**

```
When I have a question about a task, I want to add a comment, so the assignee or creator can respond.

When I'm working on an assigned task, I want to add status updates as comments, so my team knows my progress.

When I view a todo, I want to see all previous comments, so I understand the full context.

When I scan the todo list, I want to see which todos have comments, so I know where discussion is happening.
```

**What's in scope**

- Comment model (id, content, todoId, authorId, createdAt)
- Add comment form in todo edit dialog
- Comment list display in todo edit dialog
- Comment count badge on todo cards
- Server action to create comments
- Comments visible to all tenant members (same access as todo)

**What's out of scope**

- Comment editing or deletion
- Comment notifications (email or in-app)
- @mentions
- Rich text editor (plain text with optional markdown rendering)
- Real-time updates
- Comment search

---

## UI Patterns

**Todo Card**
- Small comment icon with count (e.g., "3") if comments exist
- No icon if zero comments
- Clicking card opens edit dialog with comments visible

**Todo Edit Dialog**
- Comments section below the form fields
- Header: "Comments (X)" where X is count
- Chronological list: oldest first
- Each comment shows: author name/email, relative timestamp, content
- Add comment input at bottom with "Add Comment" button
- Textarea for multi-line input
- Empty state: "No comments yet"

**Comment Display**
- Author name (or email if no name)
- Relative time ("2 hours ago", "yesterday", "Jan 15")
- Comment content (plain text, preserve line breaks)
- Simple, compact layout to fit multiple comments

---

## Default Behavior

- Any tenant member can comment on any todo in the tenant
- Comments are never editable or deletable (append-only audit trail)
- Comments are displayed oldest-first (chronological)
- Comment content is plain text (no HTML, but could render markdown later)
- Empty comment submissions are prevented (client-side validation)

---

## Prototype

Implementation will use existing shadcn/ui components (Dialog, Textarea, Button). No external design required.

---

## Dependencies

- PRD-0001 (Multi-Tenant Todo) - provides todo model and user/tenant relationship
- PRD-0010 (Todo Assignees) - comments naturally complement assignment workflow
