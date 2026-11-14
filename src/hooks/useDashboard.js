import { usePolling } from './usePolling';
import { dashboardService } from '@/services/dashboard.service';

export function useDashboard({ polling = true } = {}) {
  const poll = usePolling(
    ({ signal }) => dashboardService.getOverview({ signal }),
    { enabled: polling },
  );

  return {
    overview: poll.data,
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
  };
}
