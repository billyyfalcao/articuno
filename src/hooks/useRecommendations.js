import { usePolling } from './usePolling';
import { recommendationService } from '@/services/recommendation.service';

export function useRecommendations({ polling = true } = {}) {
  const poll = usePolling(
    ({ signal }) => recommendationService.list({ signal }),
    { enabled: polling },
  );

  return {
    recommendations: poll.data || [],
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
  };
}
