import { describe, expect, mock, test } from 'bun:test';

const mockPush = mock(() => {});
const mockSearchParams = new URLSearchParams();

mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}));

// Import after mocking
const { TodoPagination } = await import('./todo-pagination');

describe('TodoPagination', () => {
  describe('visibility', () => {
    test('returns null when totalPages is 1', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 1,
        totalCount: 5,
      });

      expect(result).toBeNull();
    });

    test('returns null when totalPages is 0', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
      });

      expect(result).toBeNull();
    });

    test('renders when totalPages is greater than 1', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 2,
        totalCount: 15,
      });

      expect(result).not.toBeNull();
    });
  });

  describe('total count display', () => {
    test('displays singular "todo" for count of 1', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 2,
        totalCount: 1,
      });

      expect(result).not.toBeNull();
      // Check the total count paragraph children: [count, " ", "todo"/"todos"]
      const countParagraph = result?.props?.children?.[0];
      expect(countParagraph?.props?.children).toEqual([1, ' ', 'todo']);
    });

    test('displays plural "todos" for count greater than 1', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 3,
        totalCount: 25,
      });

      expect(result).not.toBeNull();
      const countParagraph = result?.props?.children?.[0];
      expect(countParagraph?.props?.children).toEqual([25, ' ', 'todos']);
    });
  });

  describe('page display', () => {
    test('displays current page and total pages', () => {
      const result = TodoPagination({
        currentPage: 2,
        totalPages: 5,
        totalCount: 45,
      });

      expect(result).not.toBeNull();
      // Check the page span children: ["Page ", currentPage, " of ", totalPages]
      const pageSpan = result?.props?.children?.[1]?.props?.children?.[1];
      expect(pageSpan?.props?.children).toEqual(['Page ', 2, ' of ', 5]);
    });
  });

  describe('button disabled states', () => {
    test('Previous button is disabled on page 1', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 3,
        totalCount: 25,
      });

      expect(result).not.toBeNull();
      const props = result?.props?.children?.[1]?.props?.children;
      const prevButton = props?.[0];
      expect(prevButton?.props?.disabled).toBe(true);
    });

    test('Next button is disabled on last page', () => {
      const result = TodoPagination({
        currentPage: 3,
        totalPages: 3,
        totalCount: 25,
      });

      expect(result).not.toBeNull();
      const props = result?.props?.children?.[1]?.props?.children;
      const nextButton = props?.[2];
      expect(nextButton?.props?.disabled).toBe(true);
    });

    test('Previous button is enabled when not on page 1', () => {
      const result = TodoPagination({
        currentPage: 2,
        totalPages: 3,
        totalCount: 25,
      });

      expect(result).not.toBeNull();
      const props = result?.props?.children?.[1]?.props?.children;
      const prevButton = props?.[0];
      expect(prevButton?.props?.disabled).toBe(false);
    });

    test('Next button is enabled when not on last page', () => {
      const result = TodoPagination({
        currentPage: 1,
        totalPages: 3,
        totalCount: 25,
      });

      expect(result).not.toBeNull();
      const props = result?.props?.children?.[1]?.props?.children;
      const nextButton = props?.[2];
      expect(nextButton?.props?.disabled).toBe(false);
    });
  });
});
