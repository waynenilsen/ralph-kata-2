'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLabels, type Label } from '@/app/actions/labels';

type UseLabelsReturn = {
  labels: Label[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

/**
 * Hook to fetch and manage labels for the current tenant.
 * Uses the getLabels server action to fetch labels.
 *
 * @returns Object with labels array, loading state, error, and refetch function
 */
export function useLabels(): UseLabelsReturn {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLabels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedLabels = await getLabels();
      setLabels(fetchedLabels);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch labels');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  return { labels, isLoading, error, refetch: fetchLabels };
}
