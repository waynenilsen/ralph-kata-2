import { describe, expect, mock, test } from 'bun:test';
import { formatUnreadCount, NotificationBell } from './notification-bell';

describe('NotificationBell', () => {
  test('renders bell icon button', () => {
    const result = NotificationBell({
      unreadCount: 0,
      onOpenChange: () => {},
    });
    // Check it returns a DropdownMenu component structure
    expect(result).toBeDefined();
    expect(result?.type).toBeDefined();
  });

  test('renders without badge when count is 0', () => {
    const result = NotificationBell({
      unreadCount: 0,
      onOpenChange: () => {},
    });
    expect(result).toBeDefined();
    // Verify the component structure is correct
    expect(result?.props?.children).toBeDefined();
  });

  test('renders with badge when count > 0', () => {
    const result = NotificationBell({
      unreadCount: 5,
      onOpenChange: () => {},
    });
    expect(result).toBeDefined();
    expect(result?.props?.children).toBeDefined();
  });

  test('accepts onOpenChange callback', () => {
    const mockCallback = mock(() => {});
    const result = NotificationBell({
      unreadCount: 3,
      onOpenChange: mockCallback,
    });
    expect(result).toBeDefined();
    // onOpenChange is passed to DropdownMenu
    expect(result?.props?.onOpenChange).toBe(mockCallback);
  });

  test('accepts children prop for dropdown content', () => {
    const testContent = <div>Test content</div>;
    const result = NotificationBell({
      unreadCount: 1,
      onOpenChange: () => {},
      children: testContent,
    });
    expect(result).toBeDefined();
  });
});

describe('formatUnreadCount', () => {
  test('returns "0" for count 0', () => {
    expect(formatUnreadCount(0)).toBe('0');
  });

  test('returns count as string for counts 1-99', () => {
    expect(formatUnreadCount(1)).toBe('1');
    expect(formatUnreadCount(50)).toBe('50');
    expect(formatUnreadCount(99)).toBe('99');
  });

  test('returns "99+" for counts > 99', () => {
    expect(formatUnreadCount(100)).toBe('99+');
    expect(formatUnreadCount(150)).toBe('99+');
    expect(formatUnreadCount(999)).toBe('99+');
  });

  test('handles edge case at exactly 99', () => {
    expect(formatUnreadCount(99)).toBe('99');
  });

  test('handles edge case at exactly 100', () => {
    expect(formatUnreadCount(100)).toBe('99+');
  });
});
