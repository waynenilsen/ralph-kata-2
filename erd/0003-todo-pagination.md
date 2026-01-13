ERD: 0003
Title: Todo List Pagination
Author: Engineering
Status: Draft
PRD: [PRD-0003](../prd/0003-todo-pagination.md)
Last Updated: 2026-01-13
Reviewers: -

---

## Overview

Technical design for adding offset-based pagination to the todo list. Extends existing filter infrastructure to include page state. Uses URL search parameters for state management.

---

## Background

See [PRD-0003](../prd/0003-todo-pagination.md) for product requirements.

The existing todo list loads all todos at once, which doesn't scale. This enhancement adds pagination with server-side offset/limit queries.

---

## Goals and Non-Goals

**Goals:**
- Paginate todos with fixed page size (10 items per page)
- Store page state in URL for shareability
- Integrate with existing filter and sort functionality
- Maintain tenant isolation on all queries
- Display total count and current page position

**Non-Goals:**
- Cursor-based pagination (offset sufficient for this scale)
- Infinite scroll
- Variable page sizes
- Client-side pagination

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
┌─────────────────────────────────────────────────────┐
│                    Browser                          │
│  ┌──────────────────────────────────────────────┐  │
│  │  Existing: Filter Controls                    │  │
│  │  New: Pagination Controls                     │  │
│  │  - Previous / Next buttons                    │  │
│  │  - Page X of Y display                        │  │
│  └──────────────────────────────────────────────┘  │
│                       │                             │
│                       ▼                             │
│  URL: /todos?status=pending&sort=due-asc&page=2    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Next.js Server Component               │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Read searchParams (including page)        │  │
│  │  2. Validate and parse filter + page options  │  │
│  │  3. Build Prisma query with skip/take         │  │
│  │  4. Execute query + count with tenantId       │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    SQLite                           │
│  SELECT * FROM Todo                                 │
│  WHERE tenantId = ? AND status = ?                  │
│  ORDER BY dueDate ASC                               │
│  LIMIT 10 OFFSET 10                                 │
│                                                     │
│  SELECT COUNT(*) FROM Todo                          │
│  WHERE tenantId = ? AND status = ?                  │
└─────────────────────────────────────────────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| `lib/todo-filters.ts` | Add page parsing and skip/take to query builder |
| `app/(app)/todos/page.tsx` | Use pagination in query, pass data to pagination component |
| `app/(app)/todos/todo-pagination.tsx` | Pagination UI controls (new) |

**Data Flow**

1. User clicks Next/Previous → client-side navigation updates URL with page param
2. Page re-renders with new searchParams
3. Server component parses page number (default 1)
4. Prisma query built with skip/take based on page
5. Count query executed for total pages calculation
6. Paginated results + pagination info rendered

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Page parameter shall be validated as positive integer | Must |
| REQ-002 | Invalid page parameter shall fall back to page 1 | Must |
| REQ-003 | Page size shall be 10 items | Must |
| REQ-004 | All queries shall include tenantId filter | Must |
| REQ-005 | Pagination shall work with existing status and sort filters | Must |
| REQ-006 | UI shall display current page and total pages | Must |
| REQ-007 | Previous button shall be disabled on page 1 | Must |
| REQ-008 | Next button shall be disabled on last page | Must |
| REQ-009 | Out-of-range page numbers shall redirect to valid page | Should |

---

## API Design

Extend existing `lib/todo-filters.ts`:

```typescript
// lib/todo-filters.ts
import type { TodoStatus } from '@prisma/client';
import { z } from 'zod';

export const PAGE_SIZE = 10;

export const filterSchema = z.object({
  status: z.enum(['all', 'pending', 'completed']).default('all'),
  sort: z
    .enum(['created-desc', 'created-asc', 'due-asc', 'due-desc'])
    .default('created-desc'),
  page: z.coerce.number().int().positive().default(1),
});

export type TodoFilters = z.infer<typeof filterSchema>;

export function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): TodoFilters {
  const status = Array.isArray(searchParams.status)
    ? searchParams.status[0]
    : searchParams.status;
  const sort = Array.isArray(searchParams.sort)
    ? searchParams.sort[0]
    : searchParams.sort;
  const page = Array.isArray(searchParams.page)
    ? searchParams.page[0]
    : searchParams.page;

  const result = filterSchema.safeParse({
    status,
    sort,
    page,
  });
  return result.success ? result.data : filterSchema.parse({});
}

export function buildPrismaQuery(filters: TodoFilters, tenantId: string) {
  const where: { tenantId: string; status?: TodoStatus } = { tenantId };

  if (filters.status === 'pending') {
    where.status = 'PENDING';
  } else if (filters.status === 'completed') {
    where.status = 'COMPLETED';
  }

  const orderBy = getOrderBy(filters.sort);
  const skip = (filters.page - 1) * PAGE_SIZE;
  const take = PAGE_SIZE;

  return { where, orderBy, skip, take };
}

// getOrderBy function unchanged...
```

New pagination component:

```typescript
// app/(app)/todos/todo-pagination.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface TodoPaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export function TodoPagination({
  currentPage,
  totalPages,
  totalCount,
}: TodoPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
    const query = params.toString();
    router.push(query ? `/todos?${query}` : '/todos');
  }

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between mt-6">
      <p className="text-sm text-muted-foreground">
        {totalCount} {totalCount === 1 ? 'todo' : 'todos'}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Previous
        </Button>
        <span className="text-sm">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

Updated page component:

```typescript
// app/(app)/todos/page.tsx (relevant changes)
import { PAGE_SIZE, buildPrismaQuery, parseFilters } from '@/lib/todo-filters';
import { TodoPagination } from './todo-pagination';

// In the component:
const filters = parseFilters(await searchParams);
const { where, orderBy, skip, take } = buildPrismaQuery(filters, session.tenantId);

const [todos, totalCount, user] = await Promise.all([
  prisma.todo.findMany({
    where,
    orderBy,
    skip,
    take,
  }),
  prisma.todo.count({ where }),
  prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  }),
]);

const totalPages = Math.ceil(totalCount / PAGE_SIZE);

// In JSX, after the todos list:
<Suspense fallback={null}>
  <TodoPagination
    currentPage={filters.page}
    totalPages={totalPages}
    totalCount={totalCount}
  />
</Suspense>
```

---

## Data Model

No schema changes required. Existing indexes from ERD-0002 support pagination queries:

```prisma
@@index([tenantId, status])
@@index([tenantId, dueDate])
@@index([tenantId, createdAt])
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Cursor-based pagination | Better for real-time data | More complex, overkill for this scale | Offset is simpler and sufficient |
| Infinite scroll | Modern UX pattern | Harder to bookmark, accessibility issues | URL state more important |
| Client-side pagination | Faster page changes | Requires loading all data | Doesn't scale |
| Load more button | Simple UX | Can't jump to specific page, no total visibility | Less control for user |

---

## Security Considerations

- **Tenant Isolation:** All queries include `tenantId` from session (unchanged)
- **Input Validation:** Page number validated as positive integer; invalid values fall back to 1
- **No additional auth required:** Uses existing session-based auth
- **DoS consideration:** Page size is fixed server-side; client cannot request arbitrarily large pages

---

## Testing Strategy

- **Unit tests:** `lib/todo-filters.test.ts` extended for page parsing and skip/take
- **E2E tests:** `e2e/todo-pagination.spec.ts` for pagination interactions

Key test cases:
- Page 1 is default when no page param
- Invalid page params (negative, non-integer, too high) fall back appropriately
- skip/take calculated correctly for various pages
- Pagination works with filters (status + sort + page)
- Previous disabled on page 1, Next disabled on last page
- Total count and total pages displayed correctly
- URL reflects current page state
- Pagination respects tenant isolation

---

## Deployment

No deployment changes. No new environment variables.

---

## Dependencies

- PRD-0002 / ERD-0002 must be complete (it is)
