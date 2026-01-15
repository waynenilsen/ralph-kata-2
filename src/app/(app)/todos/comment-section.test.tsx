import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

// Mock react hooks
mock.module('react', () => ({
  ...React,
  useActionState: () => [{}, mock(() => {}), false],
}));

// Mock the createComment action
mock.module('@/app/actions/comments', () => ({
  createComment: mock(() => Promise.resolve({ success: true })),
}));

// Import after mocking
const { CommentSection } = await import('./comment-section');

describe('CommentSection', () => {
  const baseComment = {
    id: 'comment-1',
    content: 'Test comment',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    author: { id: 'user-1', email: 'test@example.com' },
  };

  describe('empty state', () => {
    test('shows empty state message when no comments', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      // Structure: div > [h4, empty state p, form]
      const children = result?.props?.children;
      const emptyMessage = children?.[1];
      expect(emptyMessage?.props?.children).toBe('No comments yet');
    });

    test('shows comment count of 0 in header', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      const children = result?.props?.children;
      const header = children?.[0];
      // Header children: ["Comments (", count, ")"]
      const headerChildren = header?.props?.children;
      expect(headerChildren?.[0]).toBe('Comments (');
      expect(headerChildren?.[1]).toBe(0);
      expect(headerChildren?.[2]).toBe(')');
    });
  });

  describe('with comments', () => {
    test('renders comment list when comments exist', () => {
      const comments = [baseComment];
      const result = CommentSection({ todoId: 'todo-1', comments });

      // Structure: div > [h4, comment list div, form]
      const children = result?.props?.children;
      const commentList = children?.[1];
      expect(commentList?.props?.className).toContain('space-y-3');
    });

    test('shows correct comment count in header', () => {
      const comments = [
        baseComment,
        { ...baseComment, id: 'comment-2', content: 'Second comment' },
      ];
      const result = CommentSection({ todoId: 'todo-1', comments });

      const children = result?.props?.children;
      const header = children?.[0];
      // Header children: ["Comments (", count, ")"]
      const headerChildren = header?.props?.children;
      expect(headerChildren?.[1]).toBe(2);
    });

    test('renders all comments', () => {
      const comments = [
        baseComment,
        { ...baseComment, id: 'comment-2', content: 'Second comment' },
        { ...baseComment, id: 'comment-3', content: 'Third comment' },
      ];
      const result = CommentSection({ todoId: 'todo-1', comments });

      const children = result?.props?.children;
      const commentList = children?.[1];
      const commentItems = commentList?.props?.children;
      expect(commentItems).toHaveLength(3);
    });
  });

  describe('add comment form', () => {
    test('renders form with textarea', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      // Get the form
      const children = result?.props?.children;
      const form = children?.[2];
      expect(form?.type).toBe('form');

      // Check for textarea in form
      const formChildren = form?.props?.children;
      const textarea = formChildren?.[0];
      expect(
        textarea?.type?.displayName || textarea?.type?.name || textarea?.type,
      ).toBe('Textarea');
    });

    test('renders submit button', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      const children = result?.props?.children;
      const form = children?.[2];
      const formChildren = form?.props?.children;
      // Button is after textarea and error message
      const button = formChildren?.[2];
      expect(button?.props?.children).toBe('Add Comment');
    });

    test('textarea has correct placeholder', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      const children = result?.props?.children;
      const form = children?.[2];
      const formChildren = form?.props?.children;
      const textarea = formChildren?.[0];
      expect(textarea?.props?.placeholder).toBe('Add a comment...');
    });

    test('textarea is required', () => {
      const result = CommentSection({ todoId: 'todo-1', comments: [] });

      const children = result?.props?.children;
      const form = children?.[2];
      const formChildren = form?.props?.children;
      const textarea = formChildren?.[0];
      expect(textarea?.props?.required).toBe(true);
    });
  });

  describe('scrollable comment list', () => {
    test('comment list has max height for scrolling', () => {
      const comments = [baseComment];
      const result = CommentSection({ todoId: 'todo-1', comments });

      const children = result?.props?.children;
      const commentList = children?.[1];
      expect(commentList?.props?.className).toContain('max-h-60');
      expect(commentList?.props?.className).toContain('overflow-y-auto');
    });
  });
});
