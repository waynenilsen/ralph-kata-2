'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useActionState, useState } from 'react';
import {
  deleteLabel,
  type LabelState,
  updateLabel,
} from '@/app/actions/labels';
import { ColorPicker } from '@/components/color-picker';
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
import { Input } from '@/components/ui/input';

type Label = {
  id: string;
  name: string;
  color: string;
  _count: { todos: number };
};

type LabelRowProps = {
  label: Label;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
};

export function LabelRow({
  label,
  isEditing,
  onEdit,
  onCancelEdit,
}: LabelRowProps) {
  const [editColor, setEditColor] = useState(label.color);
  const [isDeleting, setIsDeleting] = useState(false);

  const boundUpdateLabel = updateLabel.bind(null, label.id);
  const [editState, editFormAction, isEditPending] = useActionState<
    LabelState,
    FormData
  >(async (prevState, formData) => {
    const result = await boundUpdateLabel(prevState, formData);
    if (result.success) {
      onCancelEdit();
    }
    return result;
  }, {});

  async function handleDelete() {
    setIsDeleting(true);
    await deleteLabel(label.id);
    setIsDeleting(false);
  }

  if (isEditing) {
    return (
      <form
        action={editFormAction}
        className="flex flex-col gap-3 p-3 border rounded-lg bg-muted/30"
      >
        <div className="flex items-center gap-2">
          <Input
            name="name"
            defaultValue={label.name}
            placeholder="Label name"
            maxLength={30}
            required
            className="flex-1"
          />
        </div>

        <ColorPicker value={editColor} onChange={setEditColor} />
        <input type="hidden" name="color" value={editColor} />

        {editState.error && (
          <div className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
            {editState.error}
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={isEditPending}>
            {isEditPending ? 'Saving...' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancelEdit}
            disabled={isEditPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <LabelBadge name={label.name} color={label.color} />
        <span className="text-sm text-muted-foreground">
          {label._count.todos} {label._count.todos === 1 ? 'todo' : 'todos'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit label">
          <Pencil className="h-4 w-4" />
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" title="Delete label">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Label</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete the label &quot;{label.name}
                &quot;? This will remove it from {label._count.todos}{' '}
                {label._count.todos === 1 ? 'todo' : 'todos'}. This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
