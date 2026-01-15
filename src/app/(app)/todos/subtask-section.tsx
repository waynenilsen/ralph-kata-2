'use client';

import { Plus } from 'lucide-react';
import { useActionState, useRef } from 'react';
import { createSubtask } from '@/app/actions/subtasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SubtaskItem } from './subtask-item';

type Subtask = {
  id: string;
  title: string;
  isComplete: boolean;
  order: number;
};

type SubtaskSectionProps = {
  todoId: string;
  subtasks: Subtask[];
};

export function SubtaskSection({ todoId, subtasks }: SubtaskSectionProps) {
  const [state, formAction, isPending] = useActionState(
    createSubtask.bind(null, todoId),
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const completedCount = subtasks.filter((s) => s.isComplete).length;

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <h4 className="text-sm font-medium">
        Subtasks{' '}
        {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
      </h4>

      {subtasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">No subtasks</p>
      ) : (
        <div className="space-y-1">
          {subtasks.map((subtask) => (
            <SubtaskItem key={subtask.id} subtask={subtask} />
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="flex items-center gap-2"
      >
        <Input
          name="title"
          placeholder="Add subtask..."
          className="h-8 text-sm"
          maxLength={200}
        />
        <Button type="submit" size="sm" variant="ghost" disabled={isPending}>
          <Plus className="h-4 w-4" />
        </Button>
      </form>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  );
}
