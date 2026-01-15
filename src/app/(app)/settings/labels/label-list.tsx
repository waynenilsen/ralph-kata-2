'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LabelRow } from './label-row';

type Label = {
  id: string;
  name: string;
  color: string;
  _count: { todos: number };
};

type LabelListProps = {
  labels: Label[];
};

export function LabelList({ labels }: LabelListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Labels</CardTitle>
        <CardDescription>
          {labels.length === 0
            ? 'No labels yet. Create one above.'
            : `${labels.length} label${labels.length === 1 ? '' : 's'}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Labels help you categorize and organize your todos.
          </p>
        ) : (
          <div className="space-y-2">
            {labels.map((label) => (
              <LabelRow
                key={label.id}
                label={label}
                isEditing={editingId === label.id}
                onEdit={() => setEditingId(label.id)}
                onCancelEdit={() => setEditingId(null)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
