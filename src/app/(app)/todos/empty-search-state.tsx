'use client';

import { SearchX } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptySearchStateProps {
  query: string;
}

/**
 * Empty state component shown when search returns no results.
 * Displays search query and provides a button to clear the search.
 */
export function EmptySearchState({ query }: EmptySearchStateProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('q');
    params.delete('page');
    const queryString = params.toString();
    router.push(queryString ? `/todos?${queryString}` : '/todos');
  };

  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-muted-foreground mb-4">
          No todos found for &quot;{query}&quot;
        </p>
        <Button variant="outline" onClick={handleClear}>
          Clear search
        </Button>
      </CardContent>
    </Card>
  );
}
