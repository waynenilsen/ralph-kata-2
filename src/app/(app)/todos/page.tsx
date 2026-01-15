import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  buildAssigneeWhereClause,
  buildPrismaQuery,
  PAGE_SIZE,
  parseFilters,
} from '@/lib/todo-filters';
import { CreateTodoForm } from './create-todo-form';
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
  const where = { ...baseWhere, ...assigneeWhere };

  const [todos, totalCount, user, members] = await Promise.all([
    prisma.todo.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { assignee: { select: { email: true } } },
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
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Todos</h1>

      {isAdmin && <InviteForm />}

      <CreateTodoForm members={members} />

      <Suspense fallback={null}>
        <TodoFilters members={members} />
      </Suspense>

      {todos.length === 0 ? (
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
            <TodoCard key={todo.id} todo={todo} members={members} />
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
