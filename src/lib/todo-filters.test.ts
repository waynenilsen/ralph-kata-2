import { describe, expect, test } from 'bun:test';
import { buildPrismaQuery, filterSchema, parseFilters } from './todo-filters';

describe('filterSchema', () => {
  test('has default values for status and sort', () => {
    const result = filterSchema.parse({});

    expect(result.status).toBe('all');
    expect(result.sort).toBe('created-desc');
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
});

describe('parseFilters', () => {
  test('returns defaults for empty params', () => {
    const result = parseFilters({});

    expect(result.status).toBe('all');
    expect(result.sort).toBe('created-desc');
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
});

describe('buildPrismaQuery', () => {
  const tenantId = 'tenant-123';

  test('always includes tenantId in where clause', () => {
    const filters = { status: 'all' as const, sort: 'created-desc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.tenantId).toBe(tenantId);
  });

  test('does not filter by status when status is all', () => {
    const filters = { status: 'all' as const, sort: 'created-desc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBeUndefined();
  });

  test('filters by PENDING when status is pending', () => {
    const filters = {
      status: 'pending' as const,
      sort: 'created-desc' as const,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBe('PENDING');
  });

  test('filters by COMPLETED when status is completed', () => {
    const filters = {
      status: 'completed' as const,
      sort: 'created-desc' as const,
    };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.where.status).toBe('COMPLETED');
  });

  test('returns createdAt desc for created-desc sort', () => {
    const filters = { status: 'all' as const, sort: 'created-desc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual({ createdAt: 'desc' });
  });

  test('returns createdAt asc for created-asc sort', () => {
    const filters = { status: 'all' as const, sort: 'created-asc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual({ createdAt: 'asc' });
  });

  test('returns dueDate asc with createdAt desc fallback for due-asc sort', () => {
    const filters = { status: 'all' as const, sort: 'due-asc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual([{ dueDate: 'asc' }, { createdAt: 'desc' }]);
  });

  test('returns dueDate desc with createdAt desc fallback for due-desc sort', () => {
    const filters = { status: 'all' as const, sort: 'due-desc' as const };
    const result = buildPrismaQuery(filters, tenantId);

    expect(result.orderBy).toEqual([
      { dueDate: 'desc' },
      { createdAt: 'desc' },
    ]);
  });
});
