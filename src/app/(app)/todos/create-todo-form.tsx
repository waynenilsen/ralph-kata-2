'use client';

import { useActionState, useState } from 'react';
import { type CreateTodoState, createTodo } from '@/app/actions/todos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LabelSelector } from './label-selector';

type CreateTodoFormProps = {
  members: { id: string; email: string }[];
  labels: { id: string; name: string; color: string }[];
};

const initialState: CreateTodoState = {};

const UNASSIGNED_VALUE = 'unassigned';

export function CreateTodoForm({ members, labels }: CreateTodoFormProps) {
  const [state, formAction, pending] = useActionState(createTodo, initialState);
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED_VALUE);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // Convert the UI value to the actual form value (empty string for unassigned)
  const actualAssigneeId = assigneeId === UNASSIGNED_VALUE ? '' : assigneeId;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">Create Todo</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {state.errors?._form && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.errors._form.join(', ')}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              name="title"
              type="text"
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
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              name="description"
              type="text"
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
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              aria-invalid={!!state.errors?.dueDate}
            />
            {state.errors?.dueDate && (
              <p className="text-sm text-destructive">
                {state.errors.dueDate.join(', ')}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="assigneeId">Assignee (optional)</Label>
            <input type="hidden" name="assigneeId" value={actualAssigneeId} />
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger
                id="assigneeId"
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

          <div className="flex flex-col gap-2">
            <Label>Labels (optional)</Label>
            <input
              type="hidden"
              name="labelIds"
              value={selectedLabelIds.join(',')}
            />
            <LabelSelector
              labels={labels}
              selectedIds={selectedLabelIds}
              onSelectionChange={setSelectedLabelIds}
              disabled={pending}
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? 'Creating...' : 'Create Todo'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
