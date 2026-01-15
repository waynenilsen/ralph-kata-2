import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

mock.module('react', () => ({
  ...React,
  useState: (initial: unknown) => [initial, mock(() => {})],
  useTransition: () => [false, (cb: () => void) => cb()],
  useActionState: () => [{}, mock(() => {}), false],
}));

mock.module('@/app/actions/todos', () => ({
  deleteTodo: mock(() => Promise.resolve()),
  toggleTodo: mock(() => Promise.resolve()),
  updateTodo: mock(() => Promise.resolve()),
}));

// Import after mocking
const { TodoCard } = await import('./todo-card');

const baseTodo = {
  id: '1',
  title: 'Test Todo',
  description: 'Test description',
  status: 'PENDING',
  dueDate: null,
  assigneeId: null,
  assignee: null,
  _count: { comments: 0 },
  comments: [],
  labels: [],
  subtasks: [],
};

const members = [{ id: '1', email: 'test@example.com' }];
const labels = [
  { id: 'l1', name: 'Bug', color: '#ef4444' },
  { id: 'l2', name: 'Feature', color: '#22c55e' },
];

describe('TodoCard', () => {
  describe('comment count display', () => {
    test('does not show comment count when count is 0', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 0 } },
        members,
        labels,
      });

      // Traverse the JSX tree to find the CardContent
      const cardContent = result?.props?.children?.[1]; // CardContent is second child
      const cardContentChildren = cardContent?.props?.children;

      // The comment count div should not be present when count is 0
      // CardContent children: [description, assignee, dueDate, labels?, subtasks?, commentCount?]
      // With empty labels, subtasks and 0 comments, index 3, 4 and 5 should be falsy
      const labelsDiv = cardContentChildren?.[3];
      const subtasksDiv = cardContentChildren?.[4];
      const commentCountDiv = cardContentChildren?.[5];
      expect(labelsDiv).toBeFalsy();
      expect(subtasksDiv).toBeFalsy();
      expect(commentCountDiv).toBeFalsy();
    });

    test('shows comment count when count is greater than 0', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 5 } },
        members,
        labels,
      });

      // Traverse the JSX tree to find the CardContent
      const cardContent = result?.props?.children?.[1]; // CardContent is second child
      const cardContentChildren = cardContent?.props?.children;

      // The comment count div should be present when count > 0
      // CardContent children: [description, assignee, dueDate, labels?, subtasks?, commentCount?]
      const commentCountDiv = cardContentChildren?.[5]; // Sixth child is comment count
      expect(commentCountDiv).toBeTruthy();

      // Check the count value - div > [MessageSquare, span with count]
      const commentCountSpan = commentCountDiv?.props?.children?.[1];
      expect(commentCountSpan?.props?.children).toBe(5);
    });

    test('shows correct count for single comment', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 1 } },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const commentCountDiv = cardContentChildren?.[5];

      expect(commentCountDiv).toBeTruthy();
      const commentCountSpan = commentCountDiv?.props?.children?.[1];
      expect(commentCountSpan?.props?.children).toBe(1);
    });

    test('shows MessageSquare icon when comments exist', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 3 } },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const commentCountDiv = cardContentChildren?.[5];

      // First child should be the MessageSquare icon
      const messageSquareIcon = commentCountDiv?.props?.children?.[0];
      expect(messageSquareIcon).toBeTruthy();
      expect(
        messageSquareIcon?.type?.displayName || messageSquareIcon?.type?.name,
      ).toBe('MessageSquare');
    });
  });

  describe('label display', () => {
    test('does not show labels section when labels array is empty', () => {
      const result = TodoCard({
        todo: { ...baseTodo, labels: [] },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      // labels section would be at index 3 (after description, assignee, dueDate)
      const labelsDiv = cardContentChildren?.[3];
      // When labels is empty, this should be the comment count (falsy if comments is 0)
      expect(labelsDiv).toBeFalsy();
    });

    test('shows labels when labels array has items', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
          ],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const labelsDiv = cardContentChildren?.[3];
      expect(labelsDiv).toBeTruthy();
      expect(labelsDiv?.props?.className).toContain('flex');
    });

    test('shows maximum 3 labels', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
            { label: { id: 'l3', name: 'Urgent', color: '#0000ff' } },
            { label: { id: 'l4', name: 'Backend', color: '#ffff00' } },
            { label: { id: 'l5', name: 'Frontend', color: '#ff00ff' } },
          ],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const labelsDiv = cardContentChildren?.[3];
      const labelChildren = labelsDiv?.props?.children;

      // First child is array of LabelBadge components (max 3)
      const labelBadges = labelChildren?.[0];
      expect(labelBadges).toHaveLength(3);

      // Second child is the "+N more" span
      const moreSpan = labelChildren?.[1];
      expect(moreSpan).toBeTruthy();
      expect(moreSpan?.props?.children).toEqual(['+', 2, ' more']);
    });

    test('does not show +N more when 3 or fewer labels', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          labels: [
            { label: { id: 'l1', name: 'Bug', color: '#ff0000' } },
            { label: { id: 'l2', name: 'Feature', color: '#00ff00' } },
            { label: { id: 'l3', name: 'Urgent', color: '#0000ff' } },
          ],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const labelsDiv = cardContentChildren?.[3];
      const labelChildren = labelsDiv?.props?.children;

      // First child is array of LabelBadge components
      const labelBadges = labelChildren?.[0];
      expect(labelBadges).toHaveLength(3);

      // Second child should be falsy (no "+N more")
      const moreSpan = labelChildren?.[1];
      expect(moreSpan).toBeFalsy();
    });

    test('renders LabelBadge with correct props', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          labels: [{ label: { id: 'l1', name: 'Bug', color: '#ff0000' } }],
        },
        members,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const labelsDiv = cardContentChildren?.[3];
      const labelChildren = labelsDiv?.props?.children;
      const labelBadges = labelChildren?.[0];
      const firstBadge = labelBadges?.[0];

      expect(firstBadge?.props?.name).toBe('Bug');
      expect(firstBadge?.props?.color).toBe('#ff0000');
    });
  });

  describe('subtask progress display', () => {
    test('does not show subtask progress when subtasks array is empty', () => {
      const result = TodoCard({
        todo: { ...baseTodo, subtasks: [] },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      // subtasks section would be at index 4 (after description, assignee, dueDate, labels)
      const subtasksDiv = cardContentChildren?.[4];
      expect(subtasksDiv).toBeFalsy();
    });

    test('shows subtask progress when subtasks exist', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          subtasks: [
            { isComplete: true },
            { isComplete: false },
            { isComplete: true },
          ],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const subtasksDiv = cardContentChildren?.[4];
      expect(subtasksDiv).toBeTruthy();
      expect(subtasksDiv?.props?.['data-testid']).toBe('subtask-progress');
    });

    test('shows correct completed/total count', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          subtasks: [
            { isComplete: true },
            { isComplete: false },
            { isComplete: true },
            { isComplete: false },
            { isComplete: true },
          ],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const subtasksDiv = cardContentChildren?.[4];
      const subtaskSpan = subtasksDiv?.props?.children?.[1];

      // The span contains [completed, "/", total]
      expect(subtaskSpan?.props?.children).toEqual([3, '/', 5]);
    });

    test('shows 0/N when no subtasks are complete', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          subtasks: [{ isComplete: false }, { isComplete: false }],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const subtasksDiv = cardContentChildren?.[4];
      const subtaskSpan = subtasksDiv?.props?.children?.[1];

      expect(subtaskSpan?.props?.children).toEqual([0, '/', 2]);
    });

    test('shows N/N when all subtasks are complete', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          subtasks: [{ isComplete: true }, { isComplete: true }],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const subtasksDiv = cardContentChildren?.[4];
      const subtaskSpan = subtasksDiv?.props?.children?.[1];

      expect(subtaskSpan?.props?.children).toEqual([2, '/', 2]);
    });

    test('shows CheckSquare icon when subtasks exist', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          subtasks: [{ isComplete: true }],
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const subtasksDiv = cardContentChildren?.[4];

      // First child should be the CheckSquare icon (lucide exports as SquareCheckBig)
      const checkSquareIcon = subtasksDiv?.props?.children?.[0];
      expect(checkSquareIcon).toBeTruthy();
      expect(
        checkSquareIcon?.type?.displayName || checkSquareIcon?.type?.name,
      ).toBe('SquareCheckBig');
    });
  });

  describe('basic rendering', () => {
    test('renders todo title', () => {
      const result = TodoCard({
        todo: { ...baseTodo, title: 'My Test Todo' },
        members,
        labels,
      });

      const cardHeader = result?.props?.children?.[0];
      const headerContent = cardHeader?.props?.children?.props?.children;
      const titleSection = headerContent?.[0];
      const cardTitle = titleSection?.props?.children?.[1];
      expect(cardTitle?.props?.children).toBe('My Test Todo');
    });

    test('renders description when provided', () => {
      const result = TodoCard({
        todo: { ...baseTodo, description: 'My description' },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const descriptionParagraph = cardContentChildren?.[0];
      expect(descriptionParagraph?.props?.children).toBe('My description');
    });

    test('shows assignee when assigned', () => {
      const result = TodoCard({
        todo: {
          ...baseTodo,
          assigneeId: '2',
          assignee: { email: 'assigned@example.com' },
        },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const assigneeParagraph = cardContentChildren?.[1];
      expect(assigneeParagraph?.props?.children).toBe(
        'Assigned to: assigned@example.com',
      );
    });

    test('shows Unassigned when no assignee', () => {
      const result = TodoCard({
        todo: { ...baseTodo, assigneeId: null, assignee: null },
        members,
        labels,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const assigneeParagraph = cardContentChildren?.[1];
      expect(assigneeParagraph?.props?.children).toBe('Unassigned');
    });
  });
});
