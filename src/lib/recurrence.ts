import type { RecurrenceType } from '@prisma/client';
import {
  addDays,
  addMonths,
  addYears,
  getDate,
  lastDayOfMonth,
} from 'date-fns';

/**
 * Calculates the next due date based on recurrence type.
 *
 * Handles edge cases for month-end dates:
 * - Monthly: Jan 31 + 1 month = Feb 28 (not Mar 3)
 * - Yearly: Feb 29 + 1 year = Feb 28 (in non-leap years)
 *
 * @param currentDueDate - The current due date
 * @param recurrenceType - The type of recurrence
 * @returns The next due date, or null if recurrence is NONE
 */
export function calculateNextDueDate(
  currentDueDate: Date,
  recurrenceType: RecurrenceType,
): Date | null {
  switch (recurrenceType) {
    case 'NONE':
      return null;
    case 'DAILY':
      return addDays(currentDueDate, 1);
    case 'WEEKLY':
      return addDays(currentDueDate, 7);
    case 'BIWEEKLY':
      return addDays(currentDueDate, 14);
    case 'MONTHLY': {
      const nextMonth = addMonths(currentDueDate, 1);
      const originalDay = getDate(currentDueDate);
      const lastDayOfNextMonth = getDate(lastDayOfMonth(nextMonth));
      if (originalDay > lastDayOfNextMonth) {
        return lastDayOfMonth(nextMonth);
      }
      return nextMonth;
    }
    case 'YEARLY': {
      const nextYear = addYears(currentDueDate, 1);
      const originalDay = getDate(currentDueDate);
      const lastDayOfTargetMonth = getDate(lastDayOfMonth(nextYear));
      if (originalDay > lastDayOfTargetMonth) {
        return lastDayOfMonth(nextYear);
      }
      return nextYear;
    }
  }
}
