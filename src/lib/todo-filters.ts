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
