'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type Activity, getTodoActivities } from '@/app/actions/activities';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ActivityItem } from './activity-item';

type ActivitySectionProps = {
  todoId: string;
};

export function ActivitySection({ todoId }: ActivitySectionProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    async function fetchActivities() {
      setIsLoading(true);
      const result = await getTodoActivities(todoId);
      setActivities(result.activities);
      setIsLoading(false);
    }
    fetchActivities();
  }, [todoId]);

  return (
    <div className="border-t pt-4 mt-4">
      <Collapsible defaultOpen={false} open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:underline">
          <span>Activity ({isLoading ? '...' : activities.length})</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {activities.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
