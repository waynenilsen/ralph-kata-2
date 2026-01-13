'use client';

import { useState, useTransition } from 'react';
import { deleteTodo, toggleTodo } from '@/app/actions/todos';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EditTodoForm } from './edit-todo-form';

type TodoCardProps = {
  todo: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    dueDate: Date | null;
  };
};

export function TodoCard({ todo }: TodoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleTodo(todo.id);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteTodo(todo.id);
    });
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Edit Todo</CardTitle>
        </CardHeader>
        <CardContent>
          <EditTodoForm
            todo={todo}
            onCancel={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  const isCompleted = todo.status === 'COMPLETED';

  return (
    <Card className={isCompleted ? 'opacity-75' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              checked={isCompleted}
              onCheckedChange={handleToggle}
              disabled={isPending}
              aria-label={`Mark "${todo.title}" as ${isCompleted ? 'pending' : 'completed'}`}
            />
            <CardTitle
              className={`text-lg ${isCompleted ? 'line-through text-muted-foreground' : ''}`}
            >
              {todo.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm px-2 py-1 rounded ${
                isCompleted
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {todo.status}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isPending}>
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete todo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{todo.title}&quot;. This
                    action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {todo.description && (
          <p
            className={`mb-2 ${isCompleted ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}
          >
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
  );
}
