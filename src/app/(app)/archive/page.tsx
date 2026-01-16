import { getArchivedTodos } from '@/app/actions/todos';
import { ArchiveTodoList } from '@/components/archive-todo-list';
import { Card, CardContent } from '@/components/ui/card';

export default async function ArchivePage() {
  const { todos, error } = await getArchivedTodos();

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-semibold mb-6">Archive</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Archive</h1>
      {todos && todos.length > 0 ? (
        <ArchiveTodoList todos={todos} />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No archived todos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
