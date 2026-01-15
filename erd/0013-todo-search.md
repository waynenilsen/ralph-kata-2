ERD: 0013
Title: Todo Search
Author: Engineering
Status: Draft
PRD: [PRD-0013](../prd/0013-todo-search.md)
Last Updated: 2026-01-15
Reviewers: []

---

## Overview

This document describes the technical implementation for adding full-text search to todos. Search allows users to find todos by keywords in the title and description fields. The implementation uses SQLite FTS5 for efficient full-text indexing while maintaining tenant isolation.

---

## Background

- PRD-0013 defines the product requirements for todo search
- PRD-0001 established the multi-tenant todo system with title and description fields
- PRD-0002 established the filtering infrastructure that search will integrate with
- PRD-0003 established pagination that search results will use
- SQLite FTS5 provides full-text search capabilities without external services

---

## Goals and Non-Goals

**Goals:**
- Add full-text search across todo title and description
- Integrate search with existing filters (status, assignee, label)
- Maintain sub-200ms response times for typical queries
- Persist search state in URL for shareability
- Use SQLite FTS5 for efficient searching
- Maintain tenant isolation in search results

**Non-Goals:**
- Search within comments
- Fuzzy matching or typo tolerance
- Search result highlighting
- Search suggestions or autocomplete
- Search analytics
- Advanced query syntax for users
- Real-time search-as-you-type (debounced is sufficient)

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
│  Search     │────▶│   Filter    │────▶│   Todo      │
│   Input     │     │   Controls  │     │   List      │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                   Server Query                       │
│  - Parse search term from URL                        │
│  - Query FTS5 table for matching todo IDs            │
│  - Join with Todo table and apply filters            │
│  - Return paginated results                          │
└─────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│   Prisma    │────▶│   SQLite    │
│   + Raw SQL │     │   FTS5      │
└─────────────┘     └─────────────┘
```

**Components**

| Component | Responsibility |
|-----------|----------------|
| TodoSearchFts virtual table | FTS5 index on todo title and description |
| FTS sync triggers | Keep FTS table in sync with Todo table |
| SearchInput | Client-side search input with debouncing |
| getTodos query | Extended to support search via FTS5 |
| URL state | `?q=query` parameter for search persistence |

**Data Flow**

1. **Searching:**
   - User types query in search input
   - After 300ms debounce, URL updates with `?q=query`
   - Server component reads search param
   - Query uses FTS5 MATCH to find matching todo IDs
   - Results filtered by tenant, status, assignee, label
   - Paginated results returned

2. **FTS Synchronization:**
   - Trigger on INSERT: Add new row to FTS table
   - Trigger on UPDATE: Update corresponding FTS row
   - Trigger on DELETE: Remove row from FTS table
   - FTS table stays in sync automatically

---

## Technical Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| REQ-001 | System shall create FTS5 virtual table for todo search | Must |
| REQ-002 | FTS5 table shall index title and description fields | Must |
| REQ-003 | Triggers shall keep FTS table synchronized with Todo table | Must |
| REQ-004 | Search shall respect tenant isolation | Must |
| REQ-005 | Search shall integrate with existing filters (AND logic) | Must |
| REQ-006 | Search query shall persist in URL (?q=term) | Must |
| REQ-007 | Search input shall debounce with 300ms delay | Must |
| REQ-008 | Search shall return results in under 200ms at p95 | Must |
| REQ-009 | Empty search shall return all results | Must |
| REQ-010 | Search shall support prefix matching (partial words) | Should |
| REQ-011 | Search shall be case-insensitive | Should |
| REQ-012 | Clear button shall appear when search has value | Should |
| REQ-013 | Maximum query length shall be 100 characters | Should |

---

## API Design

### Data Fetching

The existing `getTodos` server function will be extended to support search:

```typescript
// lib/todos.ts
import { prisma } from '@/lib/prisma';

type GetTodosParams = {
  tenantId: string;
  status?: 'PENDING' | 'COMPLETED';
  assigneeId?: string;
  labelId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
  search?: string; // NEW: search query
};

export async function getTodos({
  tenantId,
  status,
  assigneeId,
  labelId,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  page = 1,
  pageSize = 10,
  search,
}: GetTodosParams) {
  // If search is provided, get matching IDs from FTS5
  let searchMatchIds: string[] | null = null;

  if (search && search.trim()) {
    const sanitizedSearch = sanitizeSearchQuery(search);
    if (sanitizedSearch) {
      // Use raw SQL to query FTS5
      const matches = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM TodoSearchFts
        WHERE TodoSearchFts MATCH ${sanitizedSearch + '*'}
      `;
      searchMatchIds = matches.map((m) => m.id);

      // If no matches found, return empty result
      if (searchMatchIds.length === 0) {
        return { todos: [], total: 0, page, pageSize, totalPages: 0 };
      }
    }
  }

  const where = {
    tenantId,
    ...(status && { status }),
    ...(assigneeId === 'unassigned'
      ? { assigneeId: null }
      : assigneeId && { assigneeId }),
    ...(labelId && {
      labels: { some: { labelId } },
    }),
    ...(searchMatchIds && {
      id: { in: searchMatchIds },
    }),
  };

  const [todos, total] = await Promise.all([
    prisma.todo.findMany({
      where,
      include: {
        assignee: true,
        createdBy: true,
        _count: { select: { comments: true } },
        labels: { include: { label: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.todo.count({ where }),
  ]);

  return {
    todos,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// Sanitize search query for FTS5
function sanitizeSearchQuery(query: string): string {
  // Remove special FTS5 characters, limit length
  return query
    .slice(0, 100)
    .replace(/[*"():-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
```

### Server Action for Search

No new server action needed - search is read-only via URL params.

---

## Data Model

### FTS5 Virtual Table

SQLite FTS5 requires a virtual table that mirrors the searchable fields. This is created via raw SQL migration, not Prisma schema.

```sql
-- Create FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS TodoSearchFts USING fts5(
  id UNINDEXED,
  title,
  description,
  content='Todo',
  content_rowid='rowid'
);

-- Trigger: Insert new todo into FTS
CREATE TRIGGER IF NOT EXISTS todo_fts_insert
AFTER INSERT ON Todo
BEGIN
  INSERT INTO TodoSearchFts(id, title, description)
  VALUES (NEW.id, NEW.title, COALESCE(NEW.description, ''));
END;

-- Trigger: Update FTS when todo changes
CREATE TRIGGER IF NOT EXISTS todo_fts_update
AFTER UPDATE ON Todo
BEGIN
  UPDATE TodoSearchFts
  SET title = NEW.title, description = COALESCE(NEW.description, '')
  WHERE id = NEW.id;
END;

-- Trigger: Delete from FTS when todo deleted
CREATE TRIGGER IF NOT EXISTS todo_fts_delete
AFTER DELETE ON Todo
BEGIN
  DELETE FROM TodoSearchFts WHERE id = OLD.id;
END;
```

### Migration Script

Since Prisma doesn't support FTS5 directly, we'll use a raw SQL migration:

```typescript
// prisma/migrations/add-fts5-search/migration.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function up() {
  // Create FTS5 virtual table
  await prisma.$executeRaw`
    CREATE VIRTUAL TABLE IF NOT EXISTS TodoSearchFts USING fts5(
      id UNINDEXED,
      title,
      description
    )
  `;

  // Create sync triggers
  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_insert
    AFTER INSERT ON Todo
    BEGIN
      INSERT INTO TodoSearchFts(id, title, description)
      VALUES (NEW.id, NEW.title, COALESCE(NEW.description, ''));
    END
  `;

  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_update
    AFTER UPDATE OF title, description ON Todo
    BEGIN
      UPDATE TodoSearchFts
      SET title = NEW.title, description = COALESCE(NEW.description, '')
      WHERE id = NEW.id;
    END
  `;

  await prisma.$executeRaw`
    CREATE TRIGGER IF NOT EXISTS todo_fts_delete
    AFTER DELETE ON Todo
    BEGIN
      DELETE FROM TodoSearchFts WHERE id = OLD.id;
    END
  `;

  // Backfill existing todos into FTS table
  await prisma.$executeRaw`
    INSERT INTO TodoSearchFts(id, title, description)
    SELECT id, title, COALESCE(description, '') FROM Todo
  `;
}

export async function down() {
  await prisma.$executeRaw`DROP TRIGGER IF EXISTS todo_fts_delete`;
  await prisma.$executeRaw`DROP TRIGGER IF EXISTS todo_fts_update`;
  await prisma.$executeRaw`DROP TRIGGER IF EXISTS todo_fts_insert`;
  await prisma.$executeRaw`DROP TABLE IF EXISTS TodoSearchFts`;
}
```

### Alternative: LIKE-based Search

If FTS5 proves problematic, fallback to LIKE queries:

```typescript
// Fallback approach without FTS5
const where = {
  tenantId,
  ...(search && {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ],
  }),
  // ... other filters
};
```

**Note:** LIKE-based search is simpler but less performant at scale. Use FTS5 as primary approach.

---

## Component Design

### SearchInput

```typescript
// app/(app)/todos/search-input.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useDebouncedCallback } from 'use-debounce';

export function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [value, setValue] = useState(initialQuery);

  // Sync with URL on mount/navigation
  useEffect(() => {
    setValue(searchParams.get('q') || '');
  }, [searchParams]);

  const updateSearch = useDebouncedCallback((query: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (query.trim()) {
      params.set('q', query.trim());
    } else {
      params.delete('q');
    }
    params.set('page', '1'); // Reset to first page
    router.push(`/todos?${params.toString()}`);
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.slice(0, 100); // Max 100 chars
    setValue(newValue);
    updateSearch(newValue);
  };

  const handleClear = () => {
    setValue('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.set('page', '1');
    router.push(`/todos?${params.toString()}`);
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search todos..."
        value={value}
        onChange={handleChange}
        className="pl-9 pr-9 w-full sm:w-64"
      />
      {value && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  );
}
```

### Integration with Filter Bar

```typescript
// app/(app)/todos/filter-bar.tsx
import { SearchInput } from './search-input';
import { StatusFilter } from './status-filter';
import { AssigneeFilter } from './assignee-filter';
import { LabelFilter } from './label-filter';
import { SortControls } from './sort-controls';

type FilterBarProps = {
  tenantMembers: Array<{ id: string; name: string | null; email: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
};

export function FilterBar({ tenantMembers, labels }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <SearchInput />
      <div className="flex flex-wrap gap-2">
        <StatusFilter />
        <AssigneeFilter members={tenantMembers} />
        <LabelFilter labels={labels} />
        <SortControls />
      </div>
    </div>
  );
}
```

### Empty State for No Results

```typescript
// app/(app)/todos/empty-search-state.tsx
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

type EmptySearchStateProps = {
  query: string;
  onClear: () => void;
};

export function EmptySearchState({ query, onClear }: EmptySearchStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">No results found</h3>
      <p className="text-muted-foreground mb-4">
        No todos found for "{query}"
      </p>
      <Button variant="outline" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}
```

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Not |
|-------------|------|------|---------|
| LIKE queries | Simple, no extra tables | O(n) performance, no ranking | Poor performance at scale |
| External search (Algolia, Elasticsearch) | Powerful features | External dependency, cost | Violates no-external-services constraint |
| SQLite FTS3/FTS4 | Well-tested | Older, less efficient than FTS5 | FTS5 is recommended for new projects |
| Search all fields | More comprehensive | Complex queries, less focused | Title + description covers 95% of use cases |
| Client-side search | No server changes | Memory issues, security concerns | Can't scale, exposes all data |

---

## Security Considerations

- **Tenant isolation**: Search query includes tenantId filter - users can only search their own todos
- **SQL injection**: Search query sanitized before FTS5 MATCH; special characters stripped
- **Query limits**: Maximum 100 characters to prevent abuse
- **No sensitive data exposure**: FTS table only contains id, title, description - no confidential fields

---

## Testing Strategy

**Unit Tests**
- sanitizeSearchQuery: strips special characters, limits length
- getTodos with search: returns matching todos
- getTodos with search + filters: combines correctly
- Empty search returns all results
- No matches returns empty array

**Integration Tests**
- FTS trigger on INSERT populates FTS table
- FTS trigger on UPDATE syncs changes
- FTS trigger on DELETE removes from FTS
- Existing todos backfilled on migration

**E2E Tests**
- User can search todos by title
- User can search todos by description
- Search respects tenant isolation (can't find other tenant's todos)
- Search combined with status filter works
- Search combined with assignee filter works
- Search combined with label filter works
- Search query persists in URL
- Clearing search shows all todos
- No results shows empty state
- Search input debounces correctly

---

## Deployment

### Migration Steps

1. Run FTS5 setup script to create virtual table and triggers
2. Backfill existing todos into FTS table
3. Deploy updated application with search UI

### Rollback

If issues arise:
1. Drop FTS triggers
2. Drop FTS virtual table
3. Deploy previous version without search

Search is additive - rollback doesn't affect core todo functionality.

---

## Tickets

Tickets should be created in this order:

1. **feat(db): add FTS5 virtual table and triggers for todo search**
   - Create TodoSearchFts FTS5 virtual table
   - Create INSERT/UPDATE/DELETE triggers for sync
   - Backfill existing todos into FTS table
   - Add migration script
   - Depends on: None

2. **feat(api): extend getTodos to support FTS5 search**
   - Add search parameter to getTodos function
   - Implement FTS5 MATCH query for search
   - Add sanitizeSearchQuery helper
   - Ensure search combines with existing filters
   - Add unit tests
   - Depends on: #1

3. **feat(ui): add SearchInput component with debouncing**
   - Create SearchInput component with search icon
   - Implement 300ms debounced URL updates
   - Add clear button when search has value
   - Sync input with URL search param
   - Depends on: None

4. **feat(ui): integrate search with todo list page**
   - Add SearchInput to filter bar
   - Update page to read `?q` search param
   - Pass search param to getTodos
   - Add empty state for no search results
   - Depends on: #2, #3

5. **test(e2e): add E2E tests for todo search**
   - Test searching by title
   - Test searching by description
   - Test search combined with filters
   - Test URL persistence
   - Test empty results state
   - Test tenant isolation
   - Depends on: #4

---

## Dependencies

- No external dependencies
- Uses existing shadcn/ui components (Input, Button)
- Requires `use-debounce` package for debouncing (or custom implementation)
- Uses Prisma raw SQL for FTS5 queries
