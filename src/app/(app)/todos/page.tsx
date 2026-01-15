import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  buildAssigneeWhereClause,
  buildLabelWhereClause,
  buildPrismaQuery,
  PAGE_SIZE,
  parseFilters,
  searchTodoIds,
} from '@/lib/todo-filters';
import { CreateTodoForm } from './create-todo-form';
import { EmptySearchState } from './empty-search-state';
import { InviteForm } from './invite-form';
import { TodoCard } from './todo-card';
import { TodoFilters } from './todo-filters';
import { TodoPagination } from './todo-pagination';

interface TodosPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TodosPage({ searchParams }: TodosPageProps) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const filters = parseFilters(await searchParams);
  const {
    where: baseWhere,
    orderBy,
    skip,
    take,
  } = buildPrismaQuery(filters, session.tenantId);

  // Apply assignee filter
  const assigneeWhere = buildAssigneeWhereClause(
    filters.assignee,
    session.userId,
  );
  // Apply label filter
  const labelWhere = buildLabelWhereClause(filters.label);
  // Apply search filter
  const searchMatchIds = await searchTodoIds(filters.q);
  // Build search where clause - if search returns empty array, no todos match
  const searchWhere =
    searchMatchIds !== null ? { id: { in: searchMatchIds } } : {};
  const where = {
    ...baseWhere,
    ...assigneeWhere,
    ...labelWhere,
    ...searchWhere,
  };

  const [todos, totalCount, user, members, labels] = await Promise.all([
    prisma.todo.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        assignee: { select: { email: true } },
        _count: { select: { comments: true } },
        comments: {
          include: {
            author: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        labels: {
          include: { label: true },
        },
        subtasks: {
          select: { isComplete: true },
        },
      },
    }),
    prisma.todo.count({ where }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true },
    }),
    prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, email: true },
      orderBy: { email: 'asc' },
    }),
    prisma.label.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Todos</h1>

      {isAdmin && <InviteForm />}

      <CreateTodoForm members={members} labels={labels} />

      <Suspense fallback={null}>
        <TodoFilters members={members} labels={labels} />
      </Suspense>

      {todos.length === 0 && filters.q ? (
        <Suspense fallback={null}>
          <EmptySearchState query={filters.q} />
        </Suspense>
      ) : todos.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No todos yet. Create your first todo to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {todos.map((todo) => (
            <TodoCard
              key={todo.id}
              todo={todo}
              members={members}
              labels={labels}
            />
          ))}
        </div>
      )}

      <Suspense fallback={null}>
        <TodoPagination
          currentPage={filters.page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </Suspense>
    </div>
  );
}
