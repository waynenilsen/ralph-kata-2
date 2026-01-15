'use client';

import type { RecurrenceType } from '@prisma/client';
import { useTransition } from 'react';
import { updateTodoRecurrence } from '@/app/actions/todos';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'NONE', label: 'Never' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Biweekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

type RecurrenceSelectProps = {
  value: RecurrenceType;
  onChange?: (value: RecurrenceType) => void;
  todoId?: string;
  disabled?: boolean;
  showHelperText?: boolean;
  isPending?: boolean;
};

/**
 * A select component for choosing recurrence type.
 * Supports controlled mode (with onChange) for create form,
 * and uncontrolled mode (with todoId) for edit form that calls server action.
 */
export function RecurrenceSelect({
  value,
  onChange,
  todoId,
  disabled = false,
  showHelperText = false,
  isPending = false,
}: RecurrenceSelectProps) {
  const [isServerPending, startTransition] = useTransition();
  const isDisabled = disabled || isPending || isServerPending;

  const handleValueChange = (newValue: string) => {
    const recurrenceType = newValue as RecurrenceType;
    if (onChange) {
      onChange(recurrenceType);
    }
    if (todoId) {
      startTransition(async () => {
        await updateTodoRecurrence(todoId, recurrenceType);
      });
    }
  };

  const selectElement = (
    <Select
      value={value}
      onValueChange={handleValueChange}
      disabled={isDisabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select recurrence" />
      </SelectTrigger>
      <SelectContent>
        {RECURRENCE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (showHelperText && disabled) {
    return (
      <div className="flex flex-col gap-1">
        {selectElement}
        <p className="text-sm text-muted-foreground">
          Set a due date to enable recurrence
        </p>
      </div>
    );
  }

  return selectElement;
}
