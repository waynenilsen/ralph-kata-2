import { getTrashedTodos } from '@/app/actions/todos';
import { TrashTodoList } from '@/components/trash-todo-list';
import { Card, CardContent } from '@/components/ui/card';

export default async function TrashPage() {
  const { todos, error } = await getTrashedTodos();

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-semibold mb-6">Trash</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Trash</h1>
      {todos && todos.length > 0 ? (
        <TrashTodoList todos={todos} />
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              No trashed todos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
