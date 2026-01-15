'use client';

import { Check } from 'lucide-react';
import { useState } from 'react';
import { LabelBadge } from '@/components/label-badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Label = {
  id: string;
  name: string;
  color: string;
};

type LabelSelectorProps = {
  labels: Label[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function LabelSelector({
  labels,
  selectedIds,
  onSelectionChange,
  disabled,
}: LabelSelectorProps) {
  const [open, setOpen] = useState(false);

  const toggleLabel = (labelId: string) => {
    const newSelection = selectedIds.includes(labelId)
      ? selectedIds.filter((id) => id !== labelId)
      : [...selectedIds, labelId];
    onSelectionChange(newSelection);
  };

  const selectedLabels = labels.filter((l) => selectedIds.includes(l.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="justify-start h-auto min-h-9 w-full"
          disabled={disabled}
          type="button"
        >
          {selectedLabels.length === 0 ? (
            <span className="text-muted-foreground">Select labels...</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selectedLabels.slice(0, 3).map((label) => (
                <LabelBadge
                  key={label.id}
                  name={label.name}
                  color={label.color}
                />
              ))}
              {selectedLabels.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedLabels.length - 3} more
                </span>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        {labels.length === 0 ? (
          <p className="text-sm text-muted-foreground p-2">
            No labels available
          </p>
        ) : (
          <div className="space-y-1">
            {labels.map((label) => (
              <button
                key={label.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-accent',
                  selectedIds.includes(label.id) && 'bg-accent',
                )}
                onClick={() => toggleLabel(label.id)}
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="flex-1 text-left truncate">{label.name}</span>
                {selectedIds.includes(label.id) && (
                  <Check className="h-4 w-4 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
