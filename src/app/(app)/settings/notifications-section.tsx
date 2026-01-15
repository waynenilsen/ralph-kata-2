'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getEmailReminderPreference,
  updateEmailReminderPreference,
} from '@/app/actions/settings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export function NotificationsSection() {
  const [emailRemindersEnabled, setEmailRemindersEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const loadPreference = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await getEmailReminderPreference();
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else if (result.emailRemindersEnabled !== undefined) {
      setEmailRemindersEnabled(result.emailRemindersEnabled);
    }
  }, []);

  useEffect(() => {
    loadPreference();
  }, [loadPreference]);

  async function handleToggle(checked: boolean) {
    setUpdating(true);
    setError('');
    setSuccess(false);

    const result = await updateEmailReminderPreference(checked);
    setUpdating(false);

    if (result.success) {
      setEmailRemindersEnabled(checked);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(result.error || 'Failed to update preference');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Manage your notification preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Loading preferences...
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
            Preference updated successfully
          </div>
        )}

        {!loading && (
          <div className="flex items-center space-x-3">
            <Checkbox
              id="email-reminders"
              checked={emailRemindersEnabled}
              disabled={updating}
              onCheckedChange={(checked) => handleToggle(checked === true)}
            />
            <Label
              htmlFor="email-reminders"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email reminders for due dates
            </Label>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
