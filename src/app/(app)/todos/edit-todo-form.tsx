'use client';

import { useActionState, useEffect, useState } from 'react';
import { type UpdateTodoState, updateTodo } from '@/app/actions/todos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CommentSection } from './comment-section';

type EditTodoFormProps = {
  todo: {
    id: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    assigneeId: string | null;
    comments: {
      id: string;
      content: string;
      createdAt: Date;
      author: { id: string; email: string };
    }[];
  };
  members: { id: string; email: string }[];
  onCancel: () => void;
  onSuccess: () => void;
};

const initialState: UpdateTodoState = {};
const UNASSIGNED_VALUE = 'unassigned';

export function EditTodoForm({
  todo,
  members,
  onCancel,
  onSuccess,
}: EditTodoFormProps) {
  const [state, formAction, pending] = useActionState(updateTodo, initialState);
  // Use UNASSIGNED_VALUE for UI when there's no assigneeId
  const [assigneeId, setAssigneeId] = useState(
    todo.assigneeId ?? UNASSIGNED_VALUE,
  );

  // Convert the UI value to the actual form value (empty string for unassigned)
  const actualAssigneeId = assigneeId === UNASSIGNED_VALUE ? '' : assigneeId;

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return (
    <>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={todo.id} />

        {state.errors?._form && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {state.errors._form.join(', ')}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor={`title-${todo.id}`}>Title</Label>
          <Input
            id={`title-${todo.id}`}
            name="title"
            type="text"
            defaultValue={todo.title}
            placeholder="What needs to be done?"
            aria-invalid={!!state.errors?.title}
            required
          />
          {state.errors?.title && (
            <p className="text-sm text-destructive">
              {state.errors.title.join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`description-${todo.id}`}>
            Description (optional)
          </Label>
          <Input
            id={`description-${todo.id}`}
            name="description"
            type="text"
            defaultValue={todo.description ?? ''}
            placeholder="Add more details..."
            aria-invalid={!!state.errors?.description}
          />
          {state.errors?.description && (
            <p className="text-sm text-destructive">
              {state.errors.description.join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`dueDate-${todo.id}`}>Due Date (optional)</Label>
          <Input
            id={`dueDate-${todo.id}`}
            name="dueDate"
            type="date"
            defaultValue={
              todo.dueDate ? todo.dueDate.toISOString().slice(0, 10) : ''
            }
            aria-invalid={!!state.errors?.dueDate}
          />
          {state.errors?.dueDate && (
            <p className="text-sm text-destructive">
              {state.errors.dueDate.join(', ')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={`assigneeId-${todo.id}`}>Assignee (optional)</Label>
          <input type="hidden" name="assigneeId" value={actualAssigneeId} />
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger
              id={`assigneeId-${todo.id}`}
              aria-invalid={!!state.errors?.assigneeId}
            >
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED_VALUE}>Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {state.errors?.assigneeId && (
            <p className="text-sm text-destructive">
              {state.errors.assigneeId.join(', ')}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>

      <CommentSection todoId={todo.id} comments={todo.comments} />
    </>
  );
}
