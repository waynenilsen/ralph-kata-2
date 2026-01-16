'use client';

import { formatDistanceToNow } from 'date-fns';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  type GetTrashedTodosResult,
  permanentDeleteTodo,
  restoreFromTrash,
} from '@/app/actions/todos';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type TrashTodoListProps = {
  todos: NonNullable<GetTrashedTodosResult['todos']>;
};

export function TrashTodoList({ todos }: TrashTodoListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [todoToDelete, setTodoToDelete] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleRestore = (todoId: string) => {
    startTransition(async () => {
      await restoreFromTrash(todoId);
    });
  };

  const handlePermanentDelete = (todoId: string) => {
    setTodoToDelete(todoId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (todoToDelete) {
      startTransition(async () => {
        await permanentDeleteTodo(todoToDelete);
        setTodoToDelete(null);
        setDeleteDialogOpen(false);
      });
    }
  };

  return (
    <>
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
                  {todo.deletedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Deleted{' '}
                      {formatDistanceToNow(new Date(todo.deletedAt), {
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
                    onClick={() => handlePermanentDelete(todo.id)}
                    title="Delete permanently"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete todo?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This todo will be permanently
              deleted and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
