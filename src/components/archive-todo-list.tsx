'use client';

import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import {
  type GetArchivedTodosResult,
  softDeleteTodo,
  unarchiveTodo,
} from '@/app/actions/todos';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ArchiveTodoListProps = {
  todos: NonNullable<GetArchivedTodosResult['todos']>;
};

export function ArchiveTodoList({ todos }: ArchiveTodoListProps) {
  const [, startTransition] = useTransition();

  const handleRestore = (todoId: string) => {
    startTransition(async () => {
      await unarchiveTodo(todoId);
    });
  };

  const handleDelete = (todoId: string) => {
    startTransition(async () => {
      await softDeleteTodo(todoId);
    });
  };

  return (
    <div className="space-y-3">
      {todos.map((todo) => (
        <Card key={todo.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-medium">{todo.title}</h3>
                {todo.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {todo.description}
                  </p>
                )}
                {todo.archivedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Archived{' '}
                    {formatDistanceToNow(new Date(todo.archivedAt), {
                      addSuffix: true,
                    })}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestore(todo.id)}
                  title="Restore"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(todo.id)}
                  title="Move to trash"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
