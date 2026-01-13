import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

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
            <Card key={todo.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{todo.title}</CardTitle>
                  <span
                    className={`text-sm px-2 py-1 rounded ${
                      todo.status === 'COMPLETED'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {todo.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {todo.description && (
                  <p className="text-muted-foreground mb-2">
                    {todo.description}
                  </p>
                )}
                {todo.dueDate && (
                  <p className="text-sm text-muted-foreground">
                    Due: {new Date(todo.dueDate).toLocaleDateString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
