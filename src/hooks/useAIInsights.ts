import { startTransition, useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { aiInsightsAPI } from '@/services/api';
import type { AIInsight, AIInsightFilters } from '@/types';

type UseAIInsightsResult = {
  insights: AIInsight[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  setInsights: Dispatch<SetStateAction<AIInsight[]>>;
};

const serializeFilters = (filters?: AIInsightFilters | null) => JSON.stringify(filters ?? null);

export const useAIInsights = (filters?: AIInsightFilters | null): UseAIInsightsResult => {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(Boolean(filters));
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const filtersKey = serializeFilters(filters);
  const activeFilters = useMemo<AIInsightFilters | null>(() => {
    if (filtersKey === 'null') return null;
    return JSON.parse(filtersKey) as AIInsightFilters;
  }, [filtersKey]);
  const refetch = useCallback(() => {
    setRefreshTick((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!activeFilters) {
      setInsights([]);
      setLoading(false);
      setError(null);
      return () => {
        cancelled = true;
      };
    }

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await aiInsightsAPI.getInsights(activeFilters);
        if (cancelled) return;

        startTransition(() => {
          setInsights(response.data.insights || []);
          setError(null);
        });
      } catch (fetchError: unknown) {
        if (cancelled) return;

        const message =
          typeof fetchError === 'object' &&
          fetchError !== null &&
          'response' in fetchError
            ? (
                fetchError as {
                  response?: {
                    data?: {
                      message?: string;
                    };
                  };
                }
              ).response?.data?.message
            : undefined;

        startTransition(() => {
          setInsights([]);
          setError(message || 'Failed to load AI insights.');
        });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void fetchInsights();

    return () => {
      cancelled = true;
    };
  }, [activeFilters, refreshTick]);

  return {
    insights,
    loading,
    error,
    refetch,
    setInsights
  };
};

export default useAIInsights;
