import { usePolling } from './usePolling';
import { sessionService } from '@/services/session.service';

export function useSessions({ status = 'TODOS', search = '', setorId = 'TODOS', polling = true } = {}) {
  const poll = usePolling(
    ({ signal }) => sessionService.list({ status, search, setorId, signal }),
    { enabled: polling, deps: [status, search, setorId] },
  );

  return {
    sessions: poll.data || [],
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
  };
}
