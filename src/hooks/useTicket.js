import { useCallback, useState } from 'react';
import { usePolling } from './usePolling';
import { ticketService } from '@/services/ticket.service';
import { isWellFormedToken } from '@/utils/token';

/**
 * Hook da sessão pública do motorista acessada via `:token`.
 */
export function useTicket(token, { polling = true } = {}) {
  const [paying, setPaying] = useState(false);
  const validFormat = isWellFormedToken(token);

  const poll = usePolling(
    ({ signal }) => ticketService.getByToken(token, { signal }),
    { enabled: polling && validFormat, deps: [token] },
  );

  const simulatePayment = useCallback(async () => {
    if (!validFormat) return null;
    setPaying(true);
    try {
      const updated = await ticketService.simulatePayment(token);
      await poll.refetch();
      return updated;
    } finally {
      setPaying(false);
    }
  }, [token, validFormat, poll]);

  return {
    ticket: poll.data,
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
    paying,
    simulatePayment,
  };
}
