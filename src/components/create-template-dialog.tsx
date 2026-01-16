'use client';

import { X } from 'lucide-react';
import { type KeyboardEvent, useState, useTransition } from 'react';
import { createTemplate } from '@/app/actions/templates';
import { useLabels } from '@/hooks/use-labels';
import { LabelBadge } from './label-badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';

const MAX_SUBTASKS = 20;

type Subtask = {
  id: string;
  title: string;
};

type CreateTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateTemplateDialog({
  open,
  onOpenChange,
}: CreateTemplateDialogProps) {
  const { labels, isLoading: labelsLoading } = useLabels();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setSelectedLabelIds([]);
    setSubtasks([]);
    setNewSubtaskTitle('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const toggleLabel = (labelId: string) => {
    setSelectedLabelIds((prev) =>
      prev.includes(labelId)
        ? prev.filter((id) => id !== labelId)
        : [...prev, labelId],
    );
  };

  const addSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title || subtasks.length >= MAX_SUBTASKS) return;

    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title }]);
    setNewSubtaskTitle('');
  };

  const removeSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubtaskKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSubtask();
    }
  };

  const handleSave = () => {
    setError(null);

    startTransition(async () => {
      const result = await createTemplate({
        name,
        description: description || undefined,
        labelIds: selectedLabelIds,
        subtasks: subtasks.map((s) => ({ title: s.title })),
      });

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        resetForm();
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Template</DialogTitle>
          <DialogDescription>
            Create a reusable template for todos with pre-defined labels and
            subtasks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
              maxLength={100}
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Template description"
              maxLength={2000}
              disabled={isPending}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Labels</Label>
            {labelsLoading ? (
              <p className="text-sm text-muted-foreground">Loading labels...</p>
            ) : labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No labels available
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                {labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => toggleLabel(label.id)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm hover:bg-accent transition-colors"
                    disabled={isPending}
                  >
                    <Checkbox
                      checked={selectedLabelIds.includes(label.id)}
                      className="pointer-events-none"
                    />
                    <LabelBadge name={label.name} color={label.color} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtasks</Label>
              <span className="text-xs text-muted-foreground">
                {subtasks.length}/{MAX_SUBTASKS}
              </span>
            </div>

            <div className="space-y-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
                >
                  <span className="flex-1 text-sm truncate">
                    {subtask.title}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => removeSubtask(subtask.id)}
                    disabled={isPending}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove subtask</span>
                  </Button>
                </div>
              ))}

              {subtasks.length < MAX_SUBTASKS && (
                <div className="flex gap-2">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={handleSubtaskKeyDown}
                    placeholder="Add subtask..."
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addSubtask}
                    disabled={isPending || !newSubtaskTitle.trim()}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
          >
            {isPending ? 'Creating...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
