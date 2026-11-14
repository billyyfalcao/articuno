import { useCallback, useState } from 'react';
import { usePolling } from './usePolling';
import { sectorService } from '@/services/sector.service';

export function useSectors({ polling = true } = {}) {
  const [adjusting, setAdjusting] = useState(false);

  const poll = usePolling(
    ({ signal }) => sectorService.list({ signal }),
    { enabled: polling },
  );

  const adjustOccupancy = useCallback(
    async ({ setorId, novaOcupacao, motivo }) => {
      setAdjusting(true);
      try {
        const res = await sectorService.adjustOccupancy({
          setorId,
          novaOcupacao,
          motivo,
        });
        await poll.refetch();
        return res;
      } finally {
        setAdjusting(false);
      }
    },
    [poll],
  );

  return {
    sectors: poll.data || [],
    loading: poll.loading,
    refreshing: poll.refreshing,
    error: poll.error,
    lastUpdatedAt: poll.lastUpdatedAt,
    refetch: poll.refetch,
    adjusting,
    adjustOccupancy,
  };
}
