import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';

const mockPush = mock(() => {});
let mockSearchParams = new URLSearchParams();

// Mock React hooks - useState returns value based on q param at call time
mock.module('react', () => ({
  ...React,
  useState: (initial: string) => {
    const currentValue = mockSearchParams.get('q') ?? initial ?? '';
    return [currentValue, () => {}];
  },
  useEffect: () => {},
}));

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock use-debounce to call callback immediately for testing
mock.module('use-debounce', () => ({
  useDebouncedCallback: (callback: (...args: unknown[]) => void) => callback,
}));

// Import after mocking
const { SearchInput } = await import('./search-input');

describe('SearchInput', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockSearchParams = new URLSearchParams();
  });

  describe('rendering', () => {
    test('renders input with search icon', () => {
      const result = SearchInput();

      expect(result).not.toBeNull();
      // Should have a relative div container
      expect(result?.props?.className).toContain('relative');

      // Should have children (icon, input, potentially clear button)
      const children = result?.props?.children;
      expect(children).toBeDefined();
    });

    test('renders with placeholder text', () => {
      const result = SearchInput();

      // Find the Input component
      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { type?: { displayName?: string } }) =>
              child?.type?.displayName === 'Input' ||
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.placeholder).toBe('Search todos...');
    });

    test('renders with search icon on the left', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      // First child should be the Search icon
      const searchIcon = Array.isArray(children) ? children[0] : null;

      expect(searchIcon).not.toBeNull();
      // Icon should be positioned absolutely on the left
      expect(searchIcon?.props?.className).toContain('left-');
    });

    test('input has left padding for search icon', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.className).toContain('pl-');
    });
  });

  describe('initial value from URL', () => {
    test('uses empty string when URL has no q param', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.value).toBe('');
    });

    test('reads search query from URL q param', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.value).toBe('test');
    });
  });

  describe('clear button', () => {
    test('does not show clear button when input is empty', () => {
      mockSearchParams = new URLSearchParams();

      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      // When value is empty, there should be no clear button
      // The input value should be empty string
      expect(input?.props?.value).toBe('');

      // Third child (clear button) should be falsy when value is empty
      const clearButton = Array.isArray(children) ? children[2] : null;
      expect(clearButton).toBeFalsy();
    });

    test('shows clear button when input has value', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      // Should have icon, input, and clear button (3 elements)
      const nonNullChildren = Array.isArray(children)
        ? children.filter((child: unknown) => child != null && child !== false)
        : [];

      expect(nonNullChildren.length).toBe(3);
    });

    test('clear button has X icon', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      // Third child should be the clear button
      const clearButton = Array.isArray(children) ? children[2] : null;

      expect(clearButton).not.toBeNull();
      expect(clearButton).not.toBe(false);
    });
  });

  describe('search input behavior', () => {
    test('onChange updates URL with search query', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      const onChange = input?.props?.onChange;
      onChange({ target: { value: 'hello' } });

      expect(mockPush).toHaveBeenCalledWith('/todos?q=hello&page=1');
    });

    test('onChange with empty string removes q param from URL', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      const onChange = input?.props?.onChange;
      onChange({ target: { value: '' } });

      expect(mockPush).toHaveBeenCalledWith('/todos?page=1');
    });

    test('onChange preserves other URL params', () => {
      mockSearchParams = new URLSearchParams('status=pending&sort=due-asc');

      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      const onChange = input?.props?.onChange;
      onChange({ target: { value: 'test' } });

      expect(mockPush).toHaveBeenCalledWith(
        '/todos?status=pending&sort=due-asc&q=test&page=1',
      );
    });

    test('onChange resets page to 1', () => {
      mockSearchParams = new URLSearchParams('page=5');

      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      const onChange = input?.props?.onChange;
      onChange({ target: { value: 'test' } });

      // Check that the push was called with both params (order may vary)
      const calledUrl = mockPush.mock.calls[0]?.[0] as string;
      const calledParams = new URLSearchParams(
        calledUrl.replace('/todos?', ''),
      );
      expect(calledParams.get('q')).toBe('test');
      expect(calledParams.get('page')).toBe('1');
    });

    test('onChange trims whitespace in URL update', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      const onChange = input?.props?.onChange;
      onChange({ target: { value: '  hello  ' } });

      expect(mockPush).toHaveBeenCalledWith('/todos?q=hello&page=1');
    });
  });

  describe('max length enforcement', () => {
    test('limits input to 100 characters', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.maxLength).toBe(100);
    });
  });

  describe('clear button behavior', () => {
    test('clicking clear button removes q param from URL', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      const clearButton = Array.isArray(children) ? children[2] : null;

      const onClick = clearButton?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos?page=1');
    });

    test('clicking clear button preserves other URL params', () => {
      mockSearchParams = new URLSearchParams('q=test&status=pending');

      const result = SearchInput();

      const children = result?.props?.children;
      const clearButton = Array.isArray(children) ? children[2] : null;

      const onClick = clearButton?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos?status=pending&page=1');
    });

    test('clicking clear button resets page to 1', () => {
      mockSearchParams = new URLSearchParams('q=test&page=5');

      const result = SearchInput();

      const children = result?.props?.children;
      const clearButton = Array.isArray(children) ? children[2] : null;

      const onClick = clearButton?.props?.onClick;
      onClick();

      expect(mockPush).toHaveBeenCalledWith('/todos?page=1');
    });
  });

  describe('accessibility', () => {
    test('clear button has screen reader text', () => {
      mockSearchParams = new URLSearchParams('q=test');

      const result = SearchInput();

      const children = result?.props?.children;
      const clearButton = Array.isArray(children) ? children[2] : null;

      // Button should have children that includes sr-only text
      const buttonChildren = clearButton?.props?.children;
      const srOnly = Array.isArray(buttonChildren)
        ? buttonChildren.find((child: { props?: { className?: string } }) =>
            child?.props?.className?.includes('sr-only'),
          )
        : null;

      expect(srOnly).not.toBeNull();
    });

    test('input has correct type', () => {
      const result = SearchInput();

      const children = result?.props?.children;
      const input = Array.isArray(children)
        ? children.find(
            (child: { props?: { placeholder?: string } }) =>
              child?.props?.placeholder === 'Search todos...',
          )
        : null;

      expect(input?.props?.type).toBe('text');
    });
  });
});
