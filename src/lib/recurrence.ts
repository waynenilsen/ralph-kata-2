import type { RecurrenceType, Todo } from '@prisma/client';
import {
  addDays,
  addMonths,
  addYears,
  getDate,
  lastDayOfMonth,
} from 'date-fns';
import { prisma } from './prisma';

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

/**
 * Generates the next instance of a recurring todo.
 *
 * Creates a new PENDING todo with:
 * - Copied title, description, assignee, recurrenceType
 * - Copied labels via TodoLabel junction table
 * - Calculated new due date based on recurrence interval
 *
 * Does NOT copy:
 * - Comments
 * - Subtasks
 *
 * @param completedTodoId - The ID of the completed recurring todo
 * @returns The newly created todo, or null if not a valid recurring todo
 */
export async function generateNextRecurringTodo(
  completedTodoId: string,
): Promise<Todo | null> {
  const completedTodo = await prisma.todo.findUnique({
    where: { id: completedTodoId },
    include: {
      labels: true,
    },
  });

  if (
    !completedTodo ||
    completedTodo.recurrenceType === 'NONE' ||
    !completedTodo.dueDate
  ) {
    return null;
  }

  const nextDueDate = calculateNextDueDate(
    completedTodo.dueDate,
    completedTodo.recurrenceType,
  );

  if (!nextDueDate) {
    return null;
  }

  // Create new todo instance
  const newTodo = await prisma.todo.create({
    data: {
      title: completedTodo.title,
      description: completedTodo.description,
      status: 'PENDING',
      dueDate: nextDueDate,
      recurrenceType: completedTodo.recurrenceType,
      tenantId: completedTodo.tenantId,
      createdById: completedTodo.createdById,
      assigneeId: completedTodo.assigneeId,
    },
  });

  // Copy labels to new todo
  if (completedTodo.labels.length > 0) {
    await prisma.todoLabel.createMany({
      data: completedTodo.labels.map((tl) => ({
        todoId: newTodo.id,
        labelId: tl.labelId,
      })),
    });
  }

  return newTodo;
}
