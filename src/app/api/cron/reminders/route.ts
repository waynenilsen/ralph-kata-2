import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { processReminders } from '@/lib/reminders';

/**
 * POST handler for processing due date reminders.
 * Protected by CRON_SECRET environment variable.
 *
 * @param request - The incoming request
 * @returns JSON response with counts of emails sent
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processReminders();

  return NextResponse.json({
    success: true,
    dueSoonSent: result.dueSoonCount,
    overdueSent: result.overdueCount,
  });
}
