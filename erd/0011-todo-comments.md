ERD: 0011
Title: Todo Comments
Author: Engineering
Status: Draft
PRD: [PRD-0011](../prd/0011-todo-comments.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding comments to todos. Users can add comments to discuss tasks, provide updates, and document decisions. Comments are append-only (no edit/delete) and visible to all tenant members.

---

## Background

- PRD-0011 defines the product requirements for todo comments
- PRD-0001 established the multi-tenant todo system with User and Todo models
- PRD-0010 added assignees, enabling task delegation that benefits from discussion
- The existing todo edit dialog will be extended to show comments

---

## Goals and Non-Goals

**Goals:**
- Add Comment model linked to Todo and User
- Allow any tenant member to add comments to any todo
- Display comments chronologically in todo edit dialog
- Show comment count on todo cards
- Maintain tenant isolation (comments only visible within tenant)

**Non-Goals:**
- Comment editing or deletion
- Real-time updates (WebSockets)
- @mentions or notifications
- Rich text editor
- File attachments
- Threaded/nested comments

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
│  Todo Card  │────▶│ Edit Dialog │────▶│  Comments   │
│  (count)    │     │  + Comments │     │   Section   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Server    │
                    │   Actions   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Prisma    │
                    │   Comment   │
                    └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| Comment model | Stores comment data with todo and author relationships |
| createComment action | Server action to add a comment to a todo |
| CommentSection | Displays comment list and add comment form |
| CommentItem | Renders a single comment with author and timestamp |
| Todo card badge | Shows comment count indicator |

**Data Flow**

1. User opens todo edit dialog
2. Dialog fetches todo with comments included (via Prisma include)
3. CommentSection renders existing comments
4. User types comment and submits
5. createComment action validates and saves
6. Page revalidates, showing new comment

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Comment model shall have id, content, todoId, authorId, createdAt fields | Must |
| REQ-002 | Comments shall be linked to exactly one Todo via foreign key | Must |
| REQ-003 | Comments shall be linked to exactly one User (author) via foreign key | Must |
| REQ-004 | Deleting a todo shall cascade delete its comments | Must |
| REQ-005 | Comments shall be ordered by createdAt ascending (oldest first) | Must |
| REQ-006 | Comment content shall not be empty (server-side validation) | Must |
| REQ-007 | Todo card shall display comment count when > 0 | Must |
| REQ-008 | createComment shall verify user belongs to same tenant as todo | Must |
| REQ-009 | Comments should load with todo in single query (no N+1) | Should |
| REQ-010 | Comment timestamps should display as relative time | Should |

---

## API Design

### Server Actions

```typescript
// app/actions/comments.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth';

export type CreateCommentState = {
  success?: boolean;
  error?: string;
};

export async function createComment(
  todoId: string,
  _prevState: CreateCommentState,
  formData: FormData
): Promise<CreateCommentState> {
  const session = await getSession();
  if (!session) {
    return { error: 'Not authenticated' };
  }

  const content = formData.get('content') as string;
  if (!content?.trim()) {
    return { error: 'Comment cannot be empty' };
  }

  // Verify todo belongs to user's tenant
  const todo = await prisma.todo.findUnique({
    where: { id: todoId },
    select: { tenantId: true },
  });

  if (!todo || todo.tenantId !== session.user.tenantId) {
    return { error: 'Todo not found' };
  }

  await prisma.comment.create({
    data: {
      content: content.trim(),
      todoId,
      authorId: session.user.id,
    },
  });

  revalidatePath('/todos');
  return { success: true };
}
```

### Data Fetching

Extend existing todo queries to include comments:

```typescript
// When fetching a single todo for edit dialog
const todo = await prisma.todo.findUnique({
  where: { id: todoId },
  include: {
    assignee: true,
    createdBy: true,
    comments: {
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    },
  },
});
```

For todo list (card display), use count aggregation:

```typescript
// When fetching todos for list
const todos = await prisma.todo.findMany({
  where: { tenantId },
  include: {
    assignee: true,
    createdBy: true,
    _count: {
      select: { comments: true },
    },
  },
});
// Access count via todo._count.comments
```

---

## Data Model

### New Prisma Schema

```prisma
// prisma/comment.prisma
model Comment {
  id        String   @id @default(cuid())
  content   String
  todo      Todo     @relation(fields: [todoId], references: [id], onDelete: Cascade)
  todoId    String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())

  @@index([todoId])
  @@index([authorId])
}
```

### Model Updates

```prisma
// prisma/todo.prisma - add relation
model Todo {
  // ... existing fields ...
  comments Comment[]
}

// prisma/user.prisma - add relation
model User {
  // ... existing fields ...
  comments Comment[]
}
```

### Migration

```bash
bunx prisma db push
```

---

## Component Design

### CommentSection

```typescript
// app/(app)/todos/comment-section.tsx
'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { createComment, CreateCommentState } from '@/app/actions/comments';
import { CommentItem } from './comment-item';

type Comment = {
  id: string;
  content: string;
  createdAt: Date;
  author: { id: string; email: string };
};

type CommentSectionProps = {
  todoId: string;
  comments: Comment[];
};

export function CommentSection({ todoId, comments }: CommentSectionProps) {
  const [state, formAction, isPending] = useActionState(
    createComment.bind(null, todoId),
    {}
  );

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium">
        Comments ({comments.length})
      </h4>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-60 overflow-y-auto">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <Textarea
          name="content"
          placeholder="Add a comment..."
          rows={2}
          required
        />
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? 'Adding...' : 'Add Comment'}
        </Button>
      </form>
    </div>
  );
}
```

### CommentItem

```typescript
// app/(app)/todos/comment-item.tsx
import { formatDistanceToNow } from 'date-fns';

type CommentItemProps = {
  comment: {
    id: string;
    content: string;
    createdAt: Date;
    author: { id: string; email: string };
  };
};

export function CommentItem({ comment }: CommentItemProps) {
  return (
    <div className="text-sm border-l-2 border-muted pl-3 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <span className="font-medium">{comment.author.email}</span>
        <span>·</span>
        <span>{formatDistanceToNow(comment.createdAt, { addSuffix: true })}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
    </div>
  );
}
```

### Todo Card Badge

Add to existing TodoCard component:

```typescript
// In todo-card.tsx, add comment count display
{todo._count.comments > 0 && (
  <div className="flex items-center gap-1 text-muted-foreground text-xs">
    <MessageSquare className="h-3 w-3" />
    <span>{todo._count.comments}</span>
  </div>
)}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Editable comments | Users can fix typos | Loses audit trail, adds complexity | Append-only is simpler and provides history |
| Nested threads | Better organization for long discussions | Significant UI complexity | Flat list sufficient for initial version |
| Real-time updates | Immediate feedback | Requires WebSocket infrastructure | Over-engineering for MVP; refresh works |
| Separate comments page | Dedicated view | Extra navigation | Inline in dialog is more convenient |

---

## Security Considerations

- **Authorization**: createComment verifies user's tenant matches todo's tenant
- **Input validation**: Content trimmed and checked for empty
- **XSS prevention**: Content rendered as text, not HTML (whitespace-pre-wrap preserves formatting)
- **No edit/delete**: Prevents tampering with comment history

---

## Testing Strategy

**Unit Tests**
- createComment action: authentication check, empty content validation, tenant verification
- CommentSection: renders comments, shows empty state, handles form submission

**E2E Tests**
- User can add comment to todo
- Comment appears in list after submission
- Comment count shows on todo card
- Comments persist across page reload
- User cannot comment on todo from another tenant

---

## Deployment

No special deployment considerations. Standard Prisma migration via `bunx prisma db push`.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add Comment model to Prisma schema**
   - Add Comment model with relationships
   - Update Todo and User models with comment relations
   - Run migration
   - Depends on: None

2. **feat(api): add createComment server action**
   - Implement createComment with validation
   - Add tenant authorization check
   - Add unit tests
   - Depends on: #1

3. **feat(ui): add comment count to todo cards**
   - Update todo query to include _count.comments
   - Add MessageSquare icon with count badge
   - Depends on: #1

4. **feat(ui): add CommentSection to edit todo dialog**
   - Create CommentItem component
   - Create CommentSection component with form
   - Integrate into EditTodoForm dialog
   - Update todo fetch to include comments
   - Depends on: #2, #3

5. **test(e2e): add E2E tests for todo comments**
   - Test adding comment
   - Test comment display
   - Test comment count on card
   - Test tenant isolation
   - Depends on: #4

---

## Dependencies

- No external dependencies
- Requires date-fns for relative time formatting (already in project from PRD-0009)
- Uses existing shadcn/ui components (Textarea, Button)
