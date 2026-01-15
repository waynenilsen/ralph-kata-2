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
};

const members = [{ id: '1', email: 'test@example.com' }];

describe('TodoCard', () => {
  describe('comment count display', () => {
    test('does not show comment count when count is 0', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 0 } },
        members,
      });

      // Traverse the JSX tree to find the CardContent
      const cardContent = result?.props?.children?.[1]; // CardContent is second child
      const cardContentChildren = cardContent?.props?.children;

      // The comment count div should not be present when count is 0
      // CardContent children: [description, assignee, dueDate, commentCount?]
      const commentCountDiv = cardContentChildren?.[3]; // Fourth child would be comment count
      expect(commentCountDiv).toBeFalsy();
    });

    test('shows comment count when count is greater than 0', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 5 } },
        members,
      });

      // Traverse the JSX tree to find the CardContent
      const cardContent = result?.props?.children?.[1]; // CardContent is second child
      const cardContentChildren = cardContent?.props?.children;

      // The comment count div should be present when count > 0
      const commentCountDiv = cardContentChildren?.[3]; // Fourth child is comment count
      expect(commentCountDiv).toBeTruthy();

      // Check the count value - div > [MessageSquare, span with count]
      const commentCountSpan = commentCountDiv?.props?.children?.[1];
      expect(commentCountSpan?.props?.children).toBe(5);
    });

    test('shows correct count for single comment', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 1 } },
        members,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const commentCountDiv = cardContentChildren?.[3];

      expect(commentCountDiv).toBeTruthy();
      const commentCountSpan = commentCountDiv?.props?.children?.[1];
      expect(commentCountSpan?.props?.children).toBe(1);
    });

    test('shows MessageSquare icon when comments exist', () => {
      const result = TodoCard({
        todo: { ...baseTodo, _count: { comments: 3 } },
        members,
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const commentCountDiv = cardContentChildren?.[3];

      // First child should be the MessageSquare icon
      const messageSquareIcon = commentCountDiv?.props?.children?.[0];
      expect(messageSquareIcon).toBeTruthy();
      expect(
        messageSquareIcon?.type?.displayName || messageSquareIcon?.type?.name,
      ).toBe('MessageSquare');
    });
  });

  describe('basic rendering', () => {
    test('renders todo title', () => {
      const result = TodoCard({
        todo: { ...baseTodo, title: 'My Test Todo' },
        members,
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
      });

      const cardContent = result?.props?.children?.[1];
      const cardContentChildren = cardContent?.props?.children;
      const assigneeParagraph = cardContentChildren?.[1];
      expect(assigneeParagraph?.props?.children).toBe('Unassigned');
    });
  });
});
