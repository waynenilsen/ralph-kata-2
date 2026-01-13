import { redirect } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { CreateTodoForm } from './create-todo-form';
import { TodoCard } from './todo-card';

export default async function TodosPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const todos = await prisma.todo.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Todos</h1>

      <CreateTodoForm />

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
            <TodoCard key={todo.id} todo={todo} />
          ))}
        </div>
      )}
    </div>
  );
}
