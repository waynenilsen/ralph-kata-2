'use client';

import { Check, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import {
  deleteSubtask,
  toggleSubtask,
  updateSubtask,
} from '@/app/actions/subtasks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type SubtaskItemProps = {
  subtask: {
    id: string;
    title: string;
    isComplete: boolean;
  };
};

export function SubtaskItem({ subtask }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(subtask.title);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      await toggleSubtask(subtask.id);
    });
  };

  const handleSave = () => {
    if (!editTitle.trim()) return;
    const formData = new FormData();
    formData.set('title', editTitle);
    startTransition(async () => {
      await updateSubtask(subtask.id, {}, formData);
      setIsEditing(false);
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteSubtask(subtask.id);
    });
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="h-7 text-sm flex-1"
          maxLength={200}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') setIsEditing(false);
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={handleSave}
          disabled={isPending}
        >
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <Checkbox
        checked={subtask.isComplete}
        onCheckedChange={handleToggle}
        disabled={isPending}
      />
      <button
        type="button"
        className={cn(
          'flex-1 text-sm text-left cursor-pointer bg-transparent border-none p-0',
          subtask.isComplete && 'line-through text-muted-foreground',
        )}
        onClick={() => setIsEditing(true)}
      >
        {subtask.title}
      </button>
      <Button
        size="sm"
        variant="ghost"
        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
        onClick={handleDelete}
        disabled={isPending}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
