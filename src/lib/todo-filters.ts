import type { TodoStatus } from '@prisma/client';
import { z } from 'zod';

export const filterSchema = z.object({
  status: z.enum(['all', 'pending', 'completed']).default('all'),
  sort: z
    .enum(['created-desc', 'created-asc', 'due-asc', 'due-desc'])
    .default('created-desc'),
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

  const result = filterSchema.safeParse({
    status,
    sort,
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
