'use client';

import type { RecurrenceType } from '@prisma/client';
import { CheckSquare, MessageSquare, Repeat } from 'lucide-react';
import { useState, useTransition } from 'react';
import { deleteTodo, toggleTodo } from '@/app/actions/todos';
import { LabelBadge } from '@/components/label-badge';
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

const recurrenceLabels: Record<RecurrenceType, string> = {
  NONE: '',
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Biweekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

type TodoCardProps = {
  todo: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    dueDate: Date | null;
    assigneeId: string | null;
    assignee: { email: string } | null;
    recurrenceType: RecurrenceType;
    _count: { comments: number };
    comments: {
      id: string;
      content: string;
      createdAt: Date;
      author: { id: string; email: string };
    }[];
    labels: {
      label: {
        id: string;
        name: string;
        color: string;
      };
    }[];
    subtasks: {
      id: string;
      title: string;
      isComplete: boolean;
      order: number;
    }[];
  };
  members: { id: string; email: string }[];
  labels: { id: string; name: string; color: string }[];
};

export function TodoCard({ todo, members, labels }: TodoCardProps) {
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
            members={members}
            labels={labels}
            onCancel={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
          />
        </CardContent>
      </Card>
    );
  }

  const isCompleted = todo.status === 'COMPLETED';

  return (
    <Card className={isCompleted ? 'opacity-75' : ''} data-testid="todo-card">
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
        <p className="text-sm text-muted-foreground">
          {todo.assignee ? `Assigned to: ${todo.assignee.email}` : 'Unassigned'}
        </p>
        {todo.dueDate && (
          <p className="text-sm text-muted-foreground">
            Due: {new Date(todo.dueDate).toLocaleDateString()}
          </p>
        )}
        {todo.labels.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            {todo.labels.slice(0, 3).map(({ label }) => (
              <LabelBadge
                key={label.id}
                name={label.name}
                color={label.color}
              />
            ))}
            {todo.labels.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{todo.labels.length - 3} more
              </span>
            )}
          </div>
        )}
        {todo.subtasks.length > 0 && (
          <div
            className="flex items-center gap-1 text-muted-foreground text-xs mt-2"
            data-testid="subtask-progress"
          >
            <CheckSquare className="h-3 w-3" />
            <span>
              {todo.subtasks.filter((s) => s.isComplete).length}/
              {todo.subtasks.length}
            </span>
          </div>
        )}
        {todo._count.comments > 0 && (
          <div className="flex items-center gap-1 text-muted-foreground text-xs mt-2">
            <MessageSquare className="h-3 w-3" />
            <span>{todo._count.comments}</span>
          </div>
        )}
        {todo.recurrenceType !== 'NONE' && (
          <div
            className="flex items-center gap-1 text-muted-foreground text-xs mt-2"
            data-testid="recurrence-indicator"
          >
            <Repeat className="h-3 w-3" />
            <span>{recurrenceLabels[todo.recurrenceType]}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
