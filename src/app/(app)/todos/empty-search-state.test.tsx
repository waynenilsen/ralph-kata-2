import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

const mockPush = mock(() => {});
let mockSearchParams = new URLSearchParams();

mock.module('react', () => ({
  ...React,
}));

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Import after mocking
const { EmptySearchState } = await import('./empty-search-state');

describe('EmptySearchState', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams('q=test');
  });

  describe('rendering', () => {
    test('renders Card wrapper', () => {
      const result = EmptySearchState({ query: 'test' });

      expect(result).not.toBeNull();
      // Card wraps CardContent
      expect(result?.props?.children).toBeDefined();
    });

    test('displays search query in message', () => {
      const result = EmptySearchState({ query: 'my search' });

      // Navigate to CardContent children
      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      // Find the paragraph element (index 2, after icon and h3)
      const paragraph = Array.isArray(children) ? children[2] : null;

      // Check that it's a paragraph with the right class
      expect(paragraph?.type).toBe('p');
      expect(paragraph?.props?.className).toContain('text-muted-foreground');

      // Children array contains the text with the query
      const paragraphChildren = paragraph?.props?.children;
      expect(paragraphChildren).toBeDefined();
      // Should include the query string
      expect(JSON.stringify(paragraphChildren)).toContain('my search');
    });

    test('renders SearchX icon', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      // First child should be the SearchX icon
      const icon = Array.isArray(children) ? children[0] : null;

      expect(icon).not.toBeNull();
      expect(icon?.props?.className).toContain('h-12');
      expect(icon?.props?.className).toContain('w-12');
    });

    test('renders heading with "No results found"', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      // Second child should be h3 heading
      const heading = Array.isArray(children) ? children[1] : null;

      expect(heading?.type).toBe('h3');
      expect(heading?.props?.children).toBe('No results found');
    });

    test('renders Clear search button', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      // Fourth child (index 3) should be the button
      const button = Array.isArray(children) ? children[3] : null;

      expect(button).not.toBeNull();
      expect(button?.props?.children).toBe('Clear search');
      expect(button?.props?.variant).toBe('outline');
    });
  });

  describe('clear button behavior', () => {
    test('clicking clear button removes q param from URL', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      const button = Array.isArray(children) ? children[3] : null;

      const onClick = button?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('clicking clear button preserves other URL params', () => {
      mockSearchParams = new URLSearchParams('q=test&status=pending');

      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      const button = Array.isArray(children) ? children[3] : null;

      const onClick = button?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos?status=pending');
    });

    test('clicking clear button removes page param', () => {
      mockSearchParams = new URLSearchParams('q=test&page=5');

      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      const button = Array.isArray(children) ? children[3] : null;

      const onClick = button?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos');
    });

    test('clicking clear button with filters preserves them', () => {
      mockSearchParams = new URLSearchParams(
        'q=test&status=pending&assignee=me&label=urgent',
      );

      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;

      const button = Array.isArray(children) ? children[3] : null;

      const onClick = button?.props?.onClick;
      onClick();

      const calledUrl = mockPush.mock.calls[0]?.[0] as string;
      const calledParams = new URLSearchParams(
        calledUrl.replace('/todos?', ''),
      );

      expect(calledParams.get('status')).toBe('pending');
      expect(calledParams.get('assignee')).toBe('me');
      expect(calledParams.get('label')).toBe('urgent');
      expect(calledParams.has('q')).toBe(false);
    });
  });

  describe('styling', () => {
    test('has centered content layout', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;

      expect(cardContent?.props?.className).toContain('flex');
      expect(cardContent?.props?.className).toContain('flex-col');
      expect(cardContent?.props?.className).toContain('items-center');
      expect(cardContent?.props?.className).toContain('justify-center');
    });

    test('has vertical padding', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;

      expect(cardContent?.props?.className).toContain('py-12');
    });
  });

  describe('query display', () => {
    test('displays short query correctly', () => {
      const result = EmptySearchState({ query: 'test' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;
      const paragraph = Array.isArray(children) ? children[2] : null;

      expect(JSON.stringify(paragraph?.props?.children)).toContain('test');
    });

    test('displays query with special characters', () => {
      const result = EmptySearchState({ query: 'test <script>' });

      const cardContent = result?.props?.children;
      const children = cardContent?.props?.children;
      const paragraph = Array.isArray(children) ? children[2] : null;

      // The query should be displayed - React handles escaping automatically
      expect(JSON.stringify(paragraph?.props?.children)).toContain(
        'test <script>',
      );
    });
  });
});
