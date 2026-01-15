import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
}));

// Import after mocking
const { LabelSelector } = await import('./label-selector');

const mockLabels = [
  { id: 'label-1', name: 'Bug', color: '#ef4444' },
  { id: 'label-2', name: 'Feature', color: '#22c55e' },
  { id: 'label-3', name: 'Documentation', color: '#3b82f6' },
  { id: 'label-4', name: 'Enhancement', color: '#f97316' },
];

describe('LabelSelector', () => {
  test('renders with no labels selected', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    // Should be a Popover component
    expect(result).toBeDefined();
  });

  test('shows placeholder when no labels selected', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    // Find the trigger button - first child is PopoverTrigger
    const trigger = result?.props?.children?.[0];
    // The button is asChild, so we need to check the Button's children
    const button = trigger?.props?.children;
    const buttonContent = button?.props?.children;

    // When no labels selected, should show placeholder text
    expect(buttonContent?.props?.children).toBe('Select labels...');
  });

  test('shows selected labels as badges', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: ['label-1', 'label-2'],
      onSelectionChange: onChange,
    });

    const trigger = result?.props?.children?.[0];
    const button = trigger?.props?.children;
    const buttonContent = button?.props?.children;

    // Should be a div with flex-wrap for badges
    expect(buttonContent?.type).toBe('div');
    expect(buttonContent?.props?.className).toContain('flex-wrap');
  });

  test('shows +N more when more than 3 labels selected', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: ['label-1', 'label-2', 'label-3', 'label-4'],
      onSelectionChange: onChange,
    });

    const trigger = result?.props?.children?.[0];
    const button = trigger?.props?.children;
    const buttonContent = button?.props?.children;
    const children = buttonContent?.props?.children;

    // Should have badges array + overflow span
    expect(children).toBeDefined();
    const overflowSpan = children?.[1];
    // children is ["+", 1, " more"] - just check it contains the number
    expect(overflowSpan?.props?.children).toEqual(['+', 1, ' more']);
  });

  test('disables button when disabled prop is true', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
      disabled: true,
    });

    const trigger = result?.props?.children?.[0];
    const button = trigger?.props?.children;
    expect(button?.props?.disabled).toBe(true);
  });

  test('shows "No labels available" when labels array is empty', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: [],
      selectedIds: [],
      onSelectionChange: onChange,
    });

    // Find the PopoverContent (second child)
    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;

    // Should show the empty state message
    expect(contentChildren?.props?.children).toBe('No labels available');
  });

  test('renders all labels in popover content', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    // Find the PopoverContent
    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;

    // Should be a div with space-y-1 containing label buttons
    expect(contentChildren?.type).toBe('div');
    expect(contentChildren?.props?.className).toContain('space-y-1');

    // Should have all 4 labels
    const labelButtons = contentChildren?.props?.children;
    expect(labelButtons?.length).toBe(4);
  });

  test('renders check icon for selected labels', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: ['label-1'],
      onSelectionChange: onChange,
    });

    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;
    const labelButtons = contentChildren?.props?.children;

    // First label button should have the Check icon as its last child
    const firstLabelButton = labelButtons?.[0];
    const buttonChildren = firstLabelButton?.props?.children;

    // Should have: color dot, text span, and Check icon
    expect(buttonChildren?.length).toBe(3);
    // Last child should be the Check icon
    const checkIcon = buttonChildren?.[2];
    expect(checkIcon).toBeDefined();
  });

  test('does not render check icon for unselected labels', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: ['label-1'],
      onSelectionChange: onChange,
    });

    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;
    const labelButtons = contentChildren?.props?.children;

    // Second label button should NOT have the Check icon
    const secondLabelButton = labelButtons?.[1];
    const buttonChildren = secondLabelButton?.props?.children;

    // The Check icon is conditionally rendered, so checking its absence
    const checkIcon = buttonChildren?.[2];
    expect(checkIcon).toBeFalsy();
  });

  test('label buttons have correct color indicators', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;
    const labelButtons = contentChildren?.props?.children;

    // Check first label's color indicator
    const firstLabelButton = labelButtons?.[0];
    const colorDot = firstLabelButton?.props?.children?.[0];

    expect(colorDot?.type).toBe('div');
    expect(colorDot?.props?.style?.backgroundColor).toBe('#ef4444');
  });

  test('labels are displayed with correct names', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;
    const labelButtons = contentChildren?.props?.children;

    // Check label names
    expect(labelButtons?.[0]?.props?.children?.[1]?.props?.children).toBe(
      'Bug',
    );
    expect(labelButtons?.[1]?.props?.children?.[1]?.props?.children).toBe(
      'Feature',
    );
    expect(labelButtons?.[2]?.props?.children?.[1]?.props?.children).toBe(
      'Documentation',
    );
    expect(labelButtons?.[3]?.props?.children?.[1]?.props?.children).toBe(
      'Enhancement',
    );
  });

  test('selected label button has bg-accent class applied twice (from cn merge)', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: ['label-1'],
      onSelectionChange: onChange,
    });

    const content = result?.props?.children?.[1];
    const contentChildren = content?.props?.children;
    const labelButtons = contentChildren?.props?.children;

    // First label is selected, should have bg-accent (appears twice due to cn merge - base and conditional)
    const selectedButton = labelButtons?.[0];
    const selectedClassName = selectedButton?.props?.className;
    // Count occurrences of bg-accent - should be 2 (hover:bg-accent and bg-accent)
    const matches = selectedClassName.match(/bg-accent/g) || [];
    expect(matches.length).toBe(2);

    // Second label is not selected, should only have hover:bg-accent
    const unselectedButton = labelButtons?.[1];
    const unselectedClassName = unselectedButton?.props?.className;
    const unselectedMatches = unselectedClassName.match(/bg-accent/g) || [];
    expect(unselectedMatches.length).toBe(1); // only hover:bg-accent
  });

  test('button is type="button"', () => {
    const onChange = mock(() => {});
    const result = LabelSelector({
      labels: mockLabels,
      selectedIds: [],
      onSelectionChange: onChange,
    });

    const trigger = result?.props?.children?.[0];
    const button = trigger?.props?.children;
    expect(button?.props?.type).toBe('button');
  });
});
