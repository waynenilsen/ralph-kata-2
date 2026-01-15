import { describe, expect, test } from 'bun:test';
import {
  buildAssigneeWhereClause,
  buildPrismaQuery,
  filterSchema,
  PAGE_SIZE,
  parseFilters,
} from './todo-filters';

describe('PAGE_SIZE', () => {
  test('is 10', () => {
    expect(PAGE_SIZE).toBe(10);
  });
});

describe('filterSchema', () => {
  test('has default values for status, sort, page, and assignee', () => {
    const result = filterSchema.parse({});

    expect(result.status).toBe('all');
    expect(result.sort).toBe('created-desc');
    expect(result.page).toBe(1);
    expect(result.assignee).toBe('all');
  });

  test('accepts valid status values', () => {
    expect(filterSchema.parse({ status: 'all' }).status).toBe('all');
    expect(filterSchema.parse({ status: 'pending' }).status).toBe('pending');
    expect(filterSchema.parse({ status: 'completed' }).status).toBe(
      'completed',
    );
  });

  test('accepts valid sort values', () => {
    expect(filterSchema.parse({ sort: 'created-desc' }).sort).toBe(
      'created-desc',
    );
    expect(filterSchema.parse({ sort: 'created-asc' }).sort).toBe(
      'created-asc',
    );
    expect(filterSchema.parse({ sort: 'due-asc' }).sort).toBe('due-asc');
    expect(filterSchema.parse({ sort: 'due-desc' }).sort).toBe('due-desc');
  });

  test('rejects invalid status values', () => {
    expect(() => filterSchema.parse({ status: 'invalid' })).toThrow();
  });

  test('rejects invalid sort values', () => {
    expect(() => filterSchema.parse({ sort: 'invalid' })).toThrow();
  });

  test('accepts valid positive integer page values', () => {
    expect(filterSchema.parse({ page: 1 }).page).toBe(1);
    expect(filterSchema.parse({ page: 5 }).page).toBe(5);
    expect(filterSchema.parse({ page: 100 }).page).toBe(100);
  });

  test('coerces string page values to integers', () => {
    expect(filterSchema.parse({ page: '1' }).page).toBe(1);
    expect(filterSchema.parse({ page: '5' }).page).toBe(5);
  });

  test('rejects invalid page values (non-positive)', () => {
    expect(() => filterSchema.parse({ page: 0 })).toThrow();
    expect(() => filterSchema.parse({ page: -1 })).toThrow();
  });

  test('rejects invalid page values (non-integer)', () => {
    expect(() => filterSchema.parse({ page: 1.5 })).toThrow();
  });

  test('rejects invalid page values (non-numeric string)', () => {
    expect(() => filterSchema.parse({ page: 'abc' })).toThrow();
  });

  test('accepts valid assignee values', () => {
    expect(filterSchema.parse({ assignee: 'all' }).assignee).toBe('all');
    expect(filterSchema.parse({ assignee: 'me' }).assignee).toBe('me');
    expect(filterSchema.parse({ assignee: 'unassigned' }).assignee).toBe(
      'unassigned',
    );
  });

  test('accepts userId as assignee value', () => {
    expect(filterSchema.parse({ assignee: 'user-123' }).assignee).toBe(
      'user-123',
    );
    expect(filterSchema.parse({ assignee: 'some-uuid-value' }).assignee).toBe(
      'some-uuid-value',
    );
  });
});

describe('parseFilters', () => {
  test('returns defaults for empty params', () => {
    const result = parseFilters({});

    expect(result.status).toBe('all');
    expect(result.sort).toBe('created-desc');
    expect(result.page).toBe(1);
    expect(result.assignee).toBe('all');
  });

  test('parses valid status parameter', () => {
    expect(parseFilters({ status: 'pending' }).status).toBe('pending');
    expect(parseFilters({ status: 'completed' }).status).toBe('completed');
    expect(parseFilters({ status: 'all' }).status).toBe('all');
  });

  test('parses valid sort parameter', () => {
    expect(parseFilters({ sort: 'created-asc' }).sort).toBe('created-asc');
    expect(parseFilters({ sort: 'due-asc' }).sort).toBe('due-asc');
    expect(parseFilters({ sort: 'due-desc' }).sort).toBe('due-desc');
  });

  test('falls back to defaults for invalid status', () => {
    const result = parseFilters({ status: 'invalid' });

    expect(result.status).toBe('all');
  });

  test('falls back to defaults for invalid sort', () => {
    const result = parseFilters({ sort: 'invalid' });

    expect(result.sort).toBe('created-desc');
  });

  test('handles array values by taking first element', () => {
    const result = parseFilters({ status: ['pending', 'completed'] });

    expect(result.status).toBe('pending');
  });

  test('handles undefined values', () => {
    const result = parseFilters({ status: undefined, sort: undefined });

    expect(result.status).toBe('all');
    expect(result.sort).toBe('created-desc');
  });

  test('parses valid page parameter', () => {
    expect(parseFilters({ page: '1' }).page).toBe(1);
    expect(parseFilters({ page: '5' }).page).toBe(5);
    expect(parseFilters({ page: '10' }).page).toBe(10);
  });

  test('falls back to page 1 for invalid page (negative)', () => {
    const result = parseFilters({ page: '-1' });

    expect(result.page).toBe(1);
  });

  test('falls back to page 1 for invalid page (zero)', () => {
    const result = parseFilters({ page: '0' });

    expect(result.page).toBe(1);
  });

  test('falls back to page 1 for invalid page (non-numeric string)', () => {
    const result = parseFilters({ page: 'abc' });

    expect(result.page).toBe(1);
  });

  test('falls back to page 1 for invalid page (decimal)', () => {
    const result = parseFilters({ page: '1.5' });

    expect(result.page).toBe(1);
  });

  test('handles array page values by taking first element', () => {
    const result = parseFilters({ page: ['2', '3'] });

    expect(result.page).toBe(2);
  });

  test('parses valid assignee parameter', () => {
    expect(parseFilters({ assignee: 'all' }).assignee).toBe('all');
    expect(parseFilters({ assignee: 'me' }).assignee).toBe('me');
    expect(parseFilters({ assignee: 'unassigned' }).assignee).toBe(
      'unassigned',
    );
  });

  test('parses userId assignee parameter', () => {
    expect(parseFilters({ assignee: 'user-123' }).assignee).toBe('user-123');
  });

  test('handles undefined assignee value', () => {
    const result = parseFilters({ assignee: undefined });

    expect(result.assignee).toBe('all');
  });

  test('handles array assignee values by taking first element', () => {
    const result = parseFilters({ assignee: ['me', 'unassigned'] });

    expect(result.assignee).toBe('me');
  });
});

describe('buildPrismaQuery', () => {
  const tenantId = 'tenant-123';

  test('always includes tenantId in where clause', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.tenantId).toBe(tenantId);
  });

  test('does not filter by status when status is all', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBeUndefined();
  });

  test('filters by PENDING when status is pending', () => {
    const filters = {
      status: 'pending' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBe('PENDING');
  });

  test('filters by COMPLETED when status is completed', () => {
    const filters = {
      status: 'completed' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBe('COMPLETED');
  });

  test('returns createdAt desc for created-desc sort', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual({ createdAt: 'desc' });
  });

  test('returns createdAt asc for created-asc sort', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-asc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual({ createdAt: 'asc' });
  });

  test('returns dueDate asc with createdAt desc fallback for due-asc sort', () => {
    const filters = {
      status: 'all' as const,
      sort: 'due-asc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual([{ dueDate: 'asc' }, { createdAt: 'desc' }]);
  });

  test('returns dueDate desc with createdAt desc fallback for due-desc sort', () => {
    const filters = {
      status: 'all' as const,
      sort: 'due-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual([
      { dueDate: 'desc' },
      { createdAt: 'desc' },
    ]);
  });

  test('returns skip 0 and take PAGE_SIZE for page 1', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 1,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.skip).toBe(0);
    expect(result.take).toBe(PAGE_SIZE);
  });

  test('returns skip PAGE_SIZE and take PAGE_SIZE for page 2', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 2,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.skip).toBe(PAGE_SIZE);
    expect(result.take).toBe(PAGE_SIZE);
  });

  test('returns correct skip for page 5', () => {
    const filters = {
      status: 'all' as const,
      sort: 'created-desc' as const,
      page: 5,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.skip).toBe(4 * PAGE_SIZE);
    expect(result.take).toBe(PAGE_SIZE);
  });
});

describe('buildAssigneeWhereClause', () => {
  const currentUserId = 'user-123';

  test('returns empty object for assignee all', () => {
    const result = buildAssigneeWhereClause('all', currentUserId);

    expect(result).toEqual({});
  });

  test('returns assigneeId with currentUserId for assignee me', () => {
    const result = buildAssigneeWhereClause('me', currentUserId);

    expect(result).toEqual({ assigneeId: currentUserId });
  });

  test('returns assigneeId null for assignee unassigned', () => {
    const result = buildAssigneeWhereClause('unassigned', currentUserId);

    expect(result).toEqual({ assigneeId: null });
  });

  test('returns assigneeId with specific userId for custom assignee value', () => {
    const result = buildAssigneeWhereClause('other-user-456', currentUserId);

    expect(result).toEqual({ assigneeId: 'other-user-456' });
  });

  test('handles UUID-style assignee values', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const result = buildAssigneeWhereClause(uuid, currentUserId);

    expect(result).toEqual({ assigneeId: uuid });
  });
});
