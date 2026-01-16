'use client';

import { formatDistanceToNow } from 'date-fns';
import type { Activity } from '@/app/actions/activities';

type ActivityItemProps = {
  activity: Activity;
};

export function getActivityMessage(activity: Activity): string {
  const actor = activity.actorEmail.split('@')[0];

  switch (activity.action) {
    case 'CREATED':
      return `${actor} created this todo`;
    case 'STATUS_CHANGED':
      return `${actor} changed status from ${activity.oldValue} to ${activity.newValue}`;
    case 'ASSIGNEE_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} assigned this todo`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed assignee`;
      }
      return `${actor} changed assignee`;
    case 'DUE_DATE_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} set due date`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed due date`;
      }
      return `${actor} changed due date`;
    case 'LABELS_CHANGED':
      if (!activity.oldValue && activity.newValue) {
        return `${actor} added label "${activity.newValue}"`;
      } else if (activity.oldValue && !activity.newValue) {
        return `${actor} removed label "${activity.oldValue}"`;
      }
      return `${actor} changed labels`;
    case 'DESCRIPTION_CHANGED':
      return `${actor} updated the description`;
    default:
      return `${actor} made a change`;
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const message = getActivityMessage(activity);
  const timeAgo = formatDistanceToNow(new Date(activity.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="flex items-start gap-2 py-2 text-sm border-b last:border-b-0">
      <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium flex-shrink-0">
        {activity.actorEmail[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </div>
  );
}
