import type { TodoStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './prisma';

export const PAGE_SIZE = 10;

export type AssigneeFilter = 'all' | 'me' | 'unassigned' | string;

export const filterSchema = z.object({
  status: z.enum(['all', 'pending', 'completed']).default('all'),
  sort: z
    .enum(['created-desc', 'created-asc', 'due-asc', 'due-desc'])
    .default('created-desc'),
  page: z.coerce.number().int().positive().default(1),
  assignee: z.string().default('all'),
  label: z.string().default('all'),
  q: z.string().default(''),
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
  const assignee = Array.isArray(searchParams.assignee)
    ? searchParams.assignee[0]
    : searchParams.assignee;
  const label = Array.isArray(searchParams.label)
    ? searchParams.label[0]
    : searchParams.label;
  const q = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q;

  const result = filterSchema.safeParse({
    status,
    sort,
    page,
    assignee,
    label,
    q,
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

export function buildAssigneeWhereClause(
  assignee: AssigneeFilter,
  currentUserId: string,
): { assigneeId?: string | null } {
  switch (assignee) {
    case 'all':
      return {};
    case 'me':
      return { assigneeId: currentUserId };
    case 'unassigned':
      return { assigneeId: null };
    default:
      return { assigneeId: assignee };
  }
}

export function buildLabelWhereClause(label: string): {
  labels?: { some: { labelId: string } };
} {
  if (label === 'all') {
    return {};
  }
  return { labels: { some: { labelId: label } } };
}

/**
 * Sanitizes a search query for use with FTS5 MATCH operator.
 * Removes special FTS5 characters and limits length to prevent abuse.
 * @param query - The raw search query from user input
 * @returns The sanitized query safe for FTS5
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .slice(0, 100)
    .replace(/[*"():-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}

/**
 * Searches for todo IDs matching the given search query using FTS5.
 * Returns null if search is empty or only whitespace.
 * Returns empty array if no matches found.
 * @param search - The raw search query from user input
 * @returns Array of matching todo IDs, or null if no search
 */
export async function searchTodoIds(
  search: string | undefined,
): Promise<string[] | null> {
  if (!search?.trim()) {
    return null;
  }

  const sanitized = sanitizeSearchQuery(search);
  if (!sanitized) {
    return null;
  }

  const matches = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM TodoSearchFts WHERE TodoSearchFts MATCH ${`${sanitized}*`}
  `;

  return matches.map((m) => m.id);
}
