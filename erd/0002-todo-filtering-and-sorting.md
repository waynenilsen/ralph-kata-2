ERD: 0002
Title: Todo Filtering and Sorting
Author: Engineering
Status: Draft
PRD: [PRD-0002](../prd/0002-todo-filtering-and-sorting.md)
Last Updated: 2026-01-13
Reviewers: -

---

## Overview

Technical design for adding filtering and sorting capabilities to the todo list. Uses URL search parameters for state management. No schema changes required.

---

## Background

See [PRD-0002](../prd/0002-todo-filtering-and-sorting.md) for product requirements.

The existing todo list displays all todos ordered by creation date. This enhancement adds user-controlled filtering and sorting.

---

## Goals and Non-Goals

**Goals:**
- Filter todos by status (all, pending, completed)
- Sort todos by created date or due date
- Persist filter/sort state in URL for shareability
- Maintain tenant isolation on all queries

**Non-Goals:**
- Full-text search
- Pagination
- Complex filter combinations
- Client-side filtering (all filtering done server-side)

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
│  │  Filter Controls (Select components)          │  │
│  │  - Status: All | Pending | Completed          │  │
│  │  - Sort: Created ↑↓ | Due Date ↑↓            │  │
│  └──────────────────────────────────────────────┘  │
│                       │                             │
│                       ▼                             │
│  URL: /todos?status=pending&sort=due-asc           │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│              Next.js Server Component               │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Read searchParams                         │  │
│  │  2. Validate and parse filter options         │  │
│  │  3. Build Prisma query with filters           │  │
│  │  4. Execute query with tenantId filter        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│                    SQLite                           │
│  SELECT * FROM Todo                                 │
│  WHERE tenantId = ? AND status = ?                  │
│  ORDER BY dueDate ASC                               │
└─────────────────────────────────────────────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| `app/(app)/todos/page.tsx` | Parse searchParams, query with filters |
| `app/(app)/todos/todo-filters.tsx` | Filter/sort UI controls (new) |
| `lib/todo-filters.ts` | Filter validation and Prisma query builder (new) |

**Data Flow**

1. User selects filter option → client-side navigation updates URL
2. Page re-renders with new searchParams
3. Server component parses and validates params
4. Prisma query built with status filter and sort order
5. Filtered results rendered

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | Filter controls shall update URL search parameters | Must |
| REQ-002 | Server shall validate filter parameters (reject invalid values) | Must |
| REQ-003 | Invalid filter parameters shall fall back to defaults | Must |
| REQ-004 | All queries shall include tenantId filter | Must |
| REQ-005 | Sort shall support ascending and descending order | Must |
| REQ-006 | Filter UI shall show current active filter state | Must |

---

## API Design

No new API routes required. Uses existing server component with searchParams.

```typescript
// lib/todo-filters.ts
import { TodoStatus } from '@prisma/client';
import { z } from 'zod';

export const filterSchema = z.object({
  status: z.enum(['all', 'pending', 'completed']).default('all'),
  sort: z.enum(['created-desc', 'created-asc', 'due-asc', 'due-desc']).default('created-desc'),
});

export type TodoFilters = z.infer<typeof filterSchema>;

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): TodoFilters {
  const result = filterSchema.safeParse({
    status: searchParams.status,
    sort: searchParams.sort,
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

  return { where, orderBy };
}

function getOrderBy(sort: TodoFilters['sort']) {
  switch (sort) {
    case 'created-desc':
      return { createdAt: 'desc' as const };
    case 'created-asc':
      return { createdAt: 'asc' as const };
    case 'due-asc':
      return [{ dueDate: 'asc' as const }, { createdAt: 'desc' as const }];
    case 'due-desc':
      return [{ dueDate: 'desc' as const }, { createdAt: 'desc' as const }];
  }
}
```

```typescript
// app/(app)/todos/todo-filters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS = [
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'due-asc', label: 'Due date (soonest)' },
  { value: 'due-desc', label: 'Due date (furthest)' },
];

export function TodoFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get('status') || 'all';
  const currentSort = searchParams.get('sort') || 'created-desc';

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' && key === 'status') {
      params.delete(key);
    } else if (value === 'created-desc' && key === 'sort') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/todos?${params.toString()}`);
  }

  return (
    <div className="flex gap-4 mb-6">
      <Select value={currentStatus} onValueChange={(v) => updateFilter('status', v)}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSort} onValueChange={(v) => updateFilter('sort', v)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

---

## Data Model

No schema changes required. Existing Todo model has all necessary fields:

- `status` - for status filtering
- `createdAt` - for created date sorting
- `dueDate` - for due date sorting
- `tenantId` - for tenant isolation

Consider adding index for better sort performance:

```prisma
// prisma/todo.prisma (optional optimization)
@@index([tenantId, status])
@@index([tenantId, dueDate])
@@index([tenantId, createdAt])
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| Client-side filtering | Faster filter changes | Doesn't scale, data over-fetching | Not scalable |
| Dedicated filter API route | Clear separation | Over-engineering for this feature | Server components sufficient |
| React state for filters | Simpler implementation | Not shareable, lost on refresh | URL state better UX |

---

## Security Considerations

- **Tenant Isolation:** All queries include `tenantId` from session (unchanged)
- **Input Validation:** Zod schema validates filter values; invalid values fall back to defaults
- **No additional auth required:** Uses existing session-based auth

---

## Testing Strategy

- **Unit tests:** `lib/todo-filters.test.ts` for filter parsing and query building
- **E2E tests:** `e2e/todo-filters.spec.ts` for filter UI interactions

Key test cases:
- Filter by pending shows only pending todos
- Filter by completed shows only completed todos
- Sort by due date orders correctly (nulls last)
- Invalid filter params fall back to defaults
- URL reflects current filter state
- Filters respect tenant isolation

---

## Deployment

No deployment changes. No new environment variables.

---

## Dependencies

- PRD-0001 / ERD-0001 must be complete (it is)
