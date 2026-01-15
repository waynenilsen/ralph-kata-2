import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, mock((fn: () => void) => fn())],
}));

// Import after mocking
const { RecurrenceSelect } = await import('./recurrence-select');

describe('RecurrenceSelect', () => {
  describe('rendering', () => {
    test('renders with NONE value by default', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      expect(result).toBeDefined();
    });

    test('renders Select component', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      // Should be a Select component (function named Select)
      expect(result?.type?.name).toBe('Select');
    });

    test('renders with disabled state when disabled prop is true', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: true,
      });

      expect(result?.props?.disabled).toBe(true);
    });

    test('renders all recurrence options in content', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      // Navigate to SelectContent (second child after SelectTrigger)
      const children = result?.props?.children;
      const selectContent = children?.[1];
      const items = selectContent?.props?.children;

      // Should have 6 options
      expect(items?.length).toBe(6);
    });

    test('renders correct option labels', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      const children = result?.props?.children;
      const selectContent = children?.[1];
      const items = selectContent?.props?.children;

      // Check option values
      expect(items?.[0]?.props?.value).toBe('NONE');
      expect(items?.[1]?.props?.value).toBe('DAILY');
      expect(items?.[2]?.props?.value).toBe('WEEKLY');
      expect(items?.[3]?.props?.value).toBe('BIWEEKLY');
      expect(items?.[4]?.props?.value).toBe('MONTHLY');
      expect(items?.[5]?.props?.value).toBe('YEARLY');
    });

    test('renders correct option display text', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      const children = result?.props?.children;
      const selectContent = children?.[1];
      const items = selectContent?.props?.children;

      // Check option labels
      expect(items?.[0]?.props?.children).toBe('Never');
      expect(items?.[1]?.props?.children).toBe('Daily');
      expect(items?.[2]?.props?.children).toBe('Weekly');
      expect(items?.[3]?.props?.children).toBe('Biweekly');
      expect(items?.[4]?.props?.children).toBe('Monthly');
      expect(items?.[5]?.props?.children).toBe('Yearly');
    });
  });

  describe('controlled mode (create form)', () => {
    test('uses provided value', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'WEEKLY',
        onChange,
      });

      expect(result?.props?.value).toBe('WEEKLY');
    });

    test('calls onChange when value changes', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
      });

      // Simulate value change
      result?.props?.onValueChange?.('DAILY');

      expect(onChange).toHaveBeenCalledWith('DAILY');
    });

    test('does not call server action in controlled mode', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        // No todoId means controlled mode
      });

      // Simulate value change
      result?.props?.onValueChange?.('DAILY');

      // Only onChange should be called, not server action
      expect(onChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('uncontrolled mode (edit form)', () => {
    test('renders with todoId for server action mode', () => {
      const result = RecurrenceSelect({
        value: 'NONE',
        todoId: 'todo-123',
      });

      expect(result).toBeDefined();
      expect(result?.props?.value).toBe('NONE');
    });

    test('allows value to be controlled externally', () => {
      const result = RecurrenceSelect({
        value: 'MONTHLY',
        todoId: 'todo-123',
      });

      expect(result?.props?.value).toBe('MONTHLY');
    });
  });

  describe('disabled state', () => {
    test('is disabled when no due date (disabled prop true)', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: true,
      });

      expect(result?.props?.disabled).toBe(true);
    });

    test('is enabled when due date exists (disabled prop false)', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: false,
      });

      expect(result?.props?.disabled).toBe(false);
    });
  });

  describe('helper text', () => {
    test('shows helper text when disabled and showHelperText is true', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: true,
        showHelperText: true,
      });

      // Component should return a fragment with Select and helper text
      // When showHelperText is true and disabled, we wrap in a div
      expect(result?.type).toBe('div');
      const children = result?.props?.children;
      // Second child should be the helper text
      const helperText = children?.[1];
      expect(helperText?.props?.children).toBe(
        'Set a due date to enable recurrence',
      );
    });

    test('does not show helper text when enabled', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: false,
        showHelperText: true,
      });

      // When not disabled, should just return the Select
      expect(result?.type?.name).toBe('Select');
    });

    test('does not show helper text when showHelperText is false', () => {
      const onChange = mock(() => {});
      const result = RecurrenceSelect({
        value: 'NONE',
        onChange,
        disabled: true,
        showHelperText: false,
      });

      // Should just return the Select without wrapper
      expect(result?.type?.name).toBe('Select');
    });
  });

  describe('loading state', () => {
    test('is disabled during loading', () => {
      const result = RecurrenceSelect({
        value: 'NONE',
        todoId: 'todo-123',
        isPending: true,
      });

      expect(result?.props?.disabled).toBe(true);
    });
  });
});
