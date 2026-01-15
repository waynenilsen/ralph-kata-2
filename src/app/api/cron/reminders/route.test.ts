import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { NextRequest } from 'next/server';
import * as remindersModule from '@/lib/reminders';
import { POST } from './route';

describe('POST /api/cron/reminders', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret-123';
  });

  test('returns 401 when CRON_SECRET is not set', async () => {
    process.env.CRON_SECRET = '';

    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer some-token',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  test('returns 401 when Authorization header is missing', async () => {
    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  test('returns 401 when Authorization header has wrong token', async () => {
    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer wrong-token',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  test('returns 401 when Authorization header format is wrong', async () => {
    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
      headers: {
        Authorization: 'test-secret-123',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json).toEqual({ error: 'Unauthorized' });
  });

  test('calls processReminders and returns counts on valid auth', async () => {
    const mockResult = { dueSoonCount: 3, overdueCount: 2 };
    const processRemindersSpy = spyOn(
      remindersModule,
      'processReminders',
    ).mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret-123',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      dueSoonSent: 3,
      overdueSent: 2,
    });
    expect(processRemindersSpy).toHaveBeenCalledTimes(1);

    processRemindersSpy.mockRestore();
  });

  test('returns zero counts when no reminders to send', async () => {
    const mockResult = { dueSoonCount: 0, overdueCount: 0 };
    const processRemindersSpy = spyOn(
      remindersModule,
      'processReminders',
    ).mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost/api/cron/reminders', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-secret-123',
      },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      success: true,
      dueSoonSent: 0,
      overdueSent: 0,
    });

    processRemindersSpy.mockRestore();
  });
});
