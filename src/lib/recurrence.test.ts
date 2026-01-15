import { describe, expect, test } from 'bun:test';
import { RecurrenceType } from '@prisma/client';
import { calculateNextDueDate } from './recurrence';

describe('calculateNextDueDate', () => {
  describe('NONE recurrence', () => {
    test('returns null for NONE recurrence type', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.NONE,
      );
      expect(result).toBeNull();
    });
  });

  describe('DAILY recurrence', () => {
    test('adds 1 day', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.DAILY,
      );
      expect(result).toEqual(new Date('2026-01-16'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-31'),
        RecurrenceType.DAILY,
      );
      expect(result).toEqual(new Date('2026-02-01'));
    });
  });

  describe('WEEKLY recurrence', () => {
    test('adds 7 days', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.WEEKLY,
      );
      expect(result).toEqual(new Date('2026-01-22'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-29'),
        RecurrenceType.WEEKLY,
      );
      expect(result).toEqual(new Date('2026-02-05'));
    });
  });

  describe('BIWEEKLY recurrence', () => {
    test('adds 14 days', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.BIWEEKLY,
      );
      expect(result).toEqual(new Date('2026-01-29'));
    });

    test('handles month boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-20'),
        RecurrenceType.BIWEEKLY,
      );
      expect(result).toEqual(new Date('2026-02-03'));
    });
  });

  describe('MONTHLY recurrence', () => {
    test('adds 1 month for regular date', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-02-15'));
    });

    test('handles month-end edge case Jan 31 -> Feb 28', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-31'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-02-28'));
    });

    test('handles month-end edge case Mar 31 -> Apr 30', () => {
      const result = calculateNextDueDate(
        new Date('2026-03-31'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-04-30'));
    });

    test('handles Feb 28 non-leap year -> Mar 28', () => {
      const result = calculateNextDueDate(
        new Date('2026-02-28'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2026-03-28'));
    });

    test('handles Dec -> Jan year boundary', () => {
      const result = calculateNextDueDate(
        new Date('2026-12-15'),
        RecurrenceType.MONTHLY,
      );
      expect(result).toEqual(new Date('2027-01-15'));
    });
  });

  describe('YEARLY recurrence', () => {
    test('adds 1 year for regular date', () => {
      const result = calculateNextDueDate(
        new Date('2026-01-15'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2027-01-15'));
    });

    test('handles leap year edge case Feb 29 -> Feb 28', () => {
      // 2024 is a leap year, 2025 is not
      const result = calculateNextDueDate(
        new Date('2024-02-29'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2025-02-28'));
    });

    test('handles leap year to leap year Feb 29', () => {
      // 2020 and 2024 are both leap years
      const result = calculateNextDueDate(
        new Date('2020-02-29'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2021-02-28'));
    });

    test('handles non-leap to leap year Feb 28', () => {
      // 2027 is not a leap year, 2028 is
      const result = calculateNextDueDate(
        new Date('2027-02-28'),
        RecurrenceType.YEARLY,
      );
      expect(result).toEqual(new Date('2028-02-28'));
    });
  });
});
