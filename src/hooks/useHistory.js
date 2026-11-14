import { usePolling } from './usePolling';
import { historyService } from '@/services/history.service';

export function useHistory({ setorId = 'TODOS', eventType = 'TODOS', polling = true } = {}) {
  const poll = usePolling(
    ({ signal }) => historyService.getHistory({ setorId, eventType, signal }),
    { enabled: polling, deps: [setorId, eventType] },
  );

  return {
    events: poll.data?.events || [],
    payments: poll.data?.payments || [],
    adjustments: poll.data?.adjustments || [],
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
  };
}
