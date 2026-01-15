'use client';

import { useActionState, useState } from 'react';
import { createLabel, type LabelState } from '@/app/actions/labels';
import { ColorPicker, PRESET_COLORS } from '@/components/color-picker';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function CreateLabelForm() {
  const [color, setColor] = useState(PRESET_COLORS[0].value);
  const [state, formAction, isPending] = useActionState<LabelState, FormData>(
    createLabel,
    {},
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Label</CardTitle>
        <CardDescription>
          Add a new label for categorizing todos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Bug, Feature, Urgent"
              maxLength={30}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Color</Label>
            <ColorPicker value={color} onChange={setColor} />
            <input type="hidden" name="color" value={color} />
          </div>

          {state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          {state.success && (
            <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
              Label created successfully
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating...' : 'Create Label'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
