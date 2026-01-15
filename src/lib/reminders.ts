import { sendEmail } from '@/lib/email/send';
import { DueSoonEmail } from '@/lib/email/templates/due-soon';
import { OverdueEmail } from '@/lib/email/templates/overdue';
import { prisma } from '@/lib/prisma';

/**
 * Result of processing reminders.
 */
export interface ProcessRemindersResult {
  /** Number of due soon reminder emails sent */
  dueSoonCount: number;
  /** Number of overdue reminder emails sent */
  overdueCount: number;
}

/**
 * Processes and sends reminder emails for todos.
 *
 * - Sends "due soon" reminders for todos due within 24-48 hours
 * - Sends "overdue" reminders for todos overdue within the past 24 hours
 * - Only processes PENDING todos
 * - Respects user opt-out preference (emailRemindersEnabled)
 * - Updates reminder sent timestamps to prevent duplicate emails
 *
 * @returns Promise with counts of emails sent for each type
 */
export async function processReminders(): Promise<ProcessRemindersResult> {
  const now = new Date();
  const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const past24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Due soon: dueDate is between 24-48 hours from now
  const dueSoonTodos = await prisma.todo.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: in24Hours,
        lt: in48Hours,
      },
      dueSoonReminderSentAt: null,
      createdBy: {
        emailRemindersEnabled: true,
      },
    },
    include: {
      createdBy: true,
    },
  });

  // Overdue: dueDate is in the past 24 hours
  const overdueTodos = await prisma.todo.findMany({
    where: {
      status: 'PENDING',
      dueDate: {
        gte: past24Hours,
        lt: now,
      },
      overdueReminderSentAt: null,
      createdBy: {
        emailRemindersEnabled: true,
      },
    },
    include: {
      createdBy: true,
    },
  });

  let dueSoonCount = 0;
  let overdueCount = 0;

  // Send due soon reminders
  for (const todo of dueSoonTodos) {
    if (!todo.dueDate) continue;

    await sendEmail({
      to: todo.createdBy.email,
      subject: `Reminder: ${todo.title} is due soon`,
      template: DueSoonEmail({
        todoTitle: todo.title,
        dueDate: todo.dueDate,
        appUrl: `${appUrl}/todos`,
      }),
    });

    await prisma.todo.update({
      where: { id: todo.id },
      data: { dueSoonReminderSentAt: now },
    });

    dueSoonCount++;
  }

  // Send overdue reminders
  for (const todo of overdueTodos) {
    if (!todo.dueDate) continue;

    await sendEmail({
      to: todo.createdBy.email,
      subject: `Overdue: ${todo.title}`,
      template: OverdueEmail({
        todoTitle: todo.title,
        dueDate: todo.dueDate,
        appUrl: `${appUrl}/todos`,
      }),
    });

    await prisma.todo.update({
      where: { id: todo.id },
      data: { overdueReminderSentAt: now },
    });

    overdueCount++;
  }

  return { dueSoonCount, overdueCount };
}
