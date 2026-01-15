'use client';

import { Bell } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Props for the NotificationBell component.
 */
export interface NotificationBellProps {
  /** The number of unread notifications */
  unreadCount: number;
  /** Callback when dropdown open state changes */
  onOpenChange: (open: boolean) => void;
  /** Optional children to render in the dropdown content */
  children?: ReactNode;
}

/**
 * Formats the unread count for display.
 * Shows "99+" for counts exceeding 99.
 *
 * @param count - The unread notification count
 * @returns Formatted count string
 */
export function formatUnreadCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/**
 * NotificationBell component displays a bell icon with an unread count badge.
 * Clicking the bell opens a dropdown menu for notifications.
 *
 * @param props - Component props
 * @returns The NotificationBell component
 */
export function NotificationBell({
  unreadCount,
  onOpenChange,
  children,
}: NotificationBellProps) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          <span className="sr-only">Notifications</span>
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
            >
              {formatUnreadCount(unreadCount)}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
