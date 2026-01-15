import { describe, expect, test } from 'bun:test';
import { CommentItem } from './comment-item';

describe('CommentItem', () => {
  const baseComment = {
    id: 'comment-1',
    content: 'Test comment content',
    createdAt: new Date('2025-01-15T10:00:00Z'),
    author: { id: 'user-1', email: 'test@example.com' },
  };

  test('renders author email', () => {
    const result = CommentItem({ comment: baseComment });

    // Get the header div with author email
    const headerDiv = result?.props?.children?.[0];
    const authorSpan = headerDiv?.props?.children?.[0];
    expect(authorSpan?.props?.children).toBe('test@example.com');
  });

  test('renders comment content', () => {
    const result = CommentItem({ comment: baseComment });

    // Get the content paragraph
    const contentParagraph = result?.props?.children?.[1];
    expect(contentParagraph?.props?.children).toBe('Test comment content');
  });

  test('renders relative timestamp', () => {
    const result = CommentItem({ comment: baseComment });

    // Get the header div with timestamp
    const headerDiv = result?.props?.children?.[0];
    const timestampSpan = headerDiv?.props?.children?.[2];
    // The timestamp should contain "ago" as it's relative
    expect(timestampSpan?.props?.children).toContain('ago');
  });

  test('preserves whitespace in content', () => {
    const commentWithWhitespace = {
      ...baseComment,
      content: 'Line 1\nLine 2\n  Indented',
    };
    const result = CommentItem({ comment: commentWithWhitespace });

    const contentParagraph = result?.props?.children?.[1];
    expect(contentParagraph?.props?.children).toBe(
      'Line 1\nLine 2\n  Indented',
    );
    expect(contentParagraph?.props?.className).toContain('whitespace-pre-wrap');
  });

  test('renders separator between author and timestamp', () => {
    const result = CommentItem({ comment: baseComment });

    const headerDiv = result?.props?.children?.[0];
    const separator = headerDiv?.props?.children?.[1];
    expect(separator?.props?.children).toBe('·');
  });

  test('displays different author email correctly', () => {
    const commentWithDifferentAuthor = {
      ...baseComment,
      author: { id: 'user-2', email: 'another@example.com' },
    };
    const result = CommentItem({ comment: commentWithDifferentAuthor });

    const headerDiv = result?.props?.children?.[0];
    const authorSpan = headerDiv?.props?.children?.[0];
    expect(authorSpan?.props?.children).toBe('another@example.com');
  });
});
