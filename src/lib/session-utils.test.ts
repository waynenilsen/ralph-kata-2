import { describe, expect, test } from 'bun:test';
import { formatLastActive, parseUserAgent } from './session-utils';

describe('parseUserAgent', () => {
  test('returns unknown for null input', () => {
    const result = parseUserAgent(null);
    expect(result.browser).toBe('Unknown');
    expect(result.os).toBe('Unknown');
    expect(result.deviceType).toBe('unknown');
    expect(result.displayName).toBe('Unknown Device');
  });

  test('returns unknown for empty string', () => {
    const result = parseUserAgent('');
    expect(result.browser).toBe('Unknown');
    expect(result.os).toBe('Unknown');
    expect(result.deviceType).toBe('unknown');
    expect(result.displayName).toBe('Unknown Device');
  });

  test('detects Chrome on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Windows');
    expect(result.deviceType).toBe('desktop');
    expect(result.displayName).toBe('Chrome on Windows');
  });

  test('detects Safari on macOS', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Safari');
    expect(result.os).toBe('macOS');
    expect(result.deviceType).toBe('desktop');
    expect(result.displayName).toBe('Safari on macOS');
  });

  test('detects Firefox on Linux', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Firefox');
    expect(result.os).toBe('Linux');
    expect(result.deviceType).toBe('desktop');
    expect(result.displayName).toBe('Firefox on Linux');
  });

  test('detects Edge on Windows', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Edge');
    expect(result.os).toBe('Windows');
    expect(result.deviceType).toBe('desktop');
    expect(result.displayName).toBe('Edge on Windows');
  });

  test('detects Chrome on Android as mobile', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('Android');
    expect(result.deviceType).toBe('mobile');
    expect(result.displayName).toBe('Chrome on Android');
  });

  test('detects Safari on iOS (iPhone) as mobile', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Safari');
    expect(result.os).toBe('iOS');
    expect(result.deviceType).toBe('mobile');
    expect(result.displayName).toBe('Safari on iOS');
  });

  test('detects Safari on iPad as tablet', () => {
    const ua =
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = parseUserAgent(ua);
    expect(result.browser).toBe('Safari');
    expect(result.os).toBe('iOS');
    expect(result.deviceType).toBe('tablet');
    expect(result.displayName).toBe('Safari on iOS');
  });
});

describe('formatLastActive', () => {
  test('returns "Unknown" for null input', () => {
    expect(formatLastActive(null)).toBe('Unknown');
  });

  test('returns "Just now" for less than 1 minute ago', () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
    expect(formatLastActive(thirtySecondsAgo)).toBe('Just now');
  });

  test('returns "1 minute ago" for exactly 1 minute ago', () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    expect(formatLastActive(oneMinuteAgo)).toBe('1 minute ago');
  });

  test('returns "X minutes ago" for less than 1 hour', () => {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    expect(formatLastActive(thirtyMinutesAgo)).toBe('30 minutes ago');
  });

  test('returns "1 hour ago" for exactly 1 hour ago', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    expect(formatLastActive(oneHourAgo)).toBe('1 hour ago');
  });

  test('returns "X hours ago" for less than 1 day', () => {
    const now = new Date();
    const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
    expect(formatLastActive(fiveHoursAgo)).toBe('5 hours ago');
  });

  test('returns "1 day ago" for exactly 1 day ago', () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(formatLastActive(oneDayAgo)).toBe('1 day ago');
  });

  test('returns "X days ago" for less than 1 week', () => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(formatLastActive(threeDaysAgo)).toBe('3 days ago');
  });

  test('returns formatted date for more than 1 week ago', () => {
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const result = formatLastActive(twoWeeksAgo);
    // Should return a formatted date string (locale-dependent)
    expect(result).toBe(twoWeeksAgo.toLocaleDateString());
  });
});
