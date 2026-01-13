'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{todo.title}</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm px-2 py-1 rounded ${
                todo.status === 'COMPLETED'
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
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {todo.description && (
          <p className="text-muted-foreground mb-2">{todo.description}</p>
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
