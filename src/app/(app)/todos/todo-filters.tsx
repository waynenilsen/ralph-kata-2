'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Member {
  id: string;
  email: string;
}

interface TodoFiltersProps {
  members: Member[];
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS = [
  { value: 'created-desc', label: 'Newest first' },
  { value: 'created-asc', label: 'Oldest first' },
  { value: 'due-asc', label: 'Due date (soonest)' },
  { value: 'due-desc', label: 'Due date (furthest)' },
];

/**
 * Filter controls component for filtering and sorting todos.
 * Updates URL search params when filter/sort selection changes.
 */
export function TodoFilters({ members }: TodoFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get('status') || 'all';
  const currentSort = searchParams.get('sort') || 'created-desc';
  const currentAssignee = searchParams.get('assignee') || 'all';

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all' && (key === 'status' || key === 'assignee')) {
      params.delete(key);
    } else if (value === 'created-desc' && key === 'sort') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const queryString = params.toString();
    router.push(queryString ? `/todos?${queryString}` : '/todos');
  }

  return (
    <div className="flex gap-4 mb-6">
      <Select
        value={currentStatus}
        onValueChange={(v) => updateFilter('status', v)}
      >
        <SelectTrigger className="w-[140px]" data-testid="status-filter">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentAssignee}
        onValueChange={(v) => updateFilter('assignee', v)}
      >
        <SelectTrigger className="w-[180px]" data-testid="assignee-filter">
          <SelectValue placeholder="All" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="me">My Todos</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {members.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              {member.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentSort}
        onValueChange={(v) => updateFilter('sort', v)}
      >
        <SelectTrigger className="w-[180px]" data-testid="sort-filter">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
