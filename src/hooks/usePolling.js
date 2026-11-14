import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import { MOCK_STORAGE_KEY } from '@/mocks/store';

/**
 * Hook de atualização periódica (polling ~2,5s) seguro e eficiente:
 *  - Usa setTimeout encadeado: a próxima requisição só é agendada APÓS a anterior
 *    terminar, evitando requisições simultâneas sobrepostas.
 *  - Cancela a requisição em andamento via AbortController ao sair da página.
 *  - Pausa quando a aba está oculta (document.hidden) e retoma imediatamente ao voltar.
 *  - No modo mock, também escuta o evento `storage` do navegador para refletir
 *    mudanças e restaurações feitas em outra aba sem atraso.
 *  - Quando uma consulta de atualização retorna erro (ex.: sessão recém-encerrada ou
 *    removida após restauração dos dados), limpa dados obsoletos e expõe o erro.
 */
export function usePolling(
  fetcher,
  { intervalMs = APP_CONFIG.polling.intervalMs, enabled = true, deps = [] } = {},
) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const mountedRef = useRef(false);
  const inFlightControllerRef = useRef(null);
  const timerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const clearScheduledTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const abortInFlight = () => {
    if (inFlightControllerRef.current) {
      inFlightControllerRef.current.abort();
      inFlightControllerRef.current = null;
    }
  };

  const runOnce = useCallback(async () => {
    if (!mountedRef.current) return null;
    if (inFlightControllerRef.current) return null; // garante ausência de sobreposição

    const controller = new AbortController();
    inFlightControllerRef.current = controller;

    if (!hasLoadedOnceRef.current) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const result = await fetcherRef.current({ signal: controller.signal });
      if (!mountedRef.current || controller.signal.aborted) return null;

      hasLoadedOnceRef.current = true;
      setData(result);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      return result;
    } catch (err) {
      if (!mountedRef.current || controller.signal.aborted || err?.name === 'AbortError') {
        return null;
      }
      // Se o recurso passou a retornar 404 (ex.: sessão finalizada ou resetada),
      // descarta o dado obsoleto imediatamente para bloquear operações inválidas.
      if (err?.status === 404) {
        setData(null);
      }
      setError(err);
      return null;
    } finally {
      if (inFlightControllerRef.current === controller) {
        inFlightControllerRef.current = null;
      }
      if (mountedRef.current && !controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    let cancelled = false;

    const scheduleNext = () => {
      clearScheduledTimer();
      if (cancelled || !mountedRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      timerRef.current = setTimeout(async () => {
        await runOnce();
        scheduleNext();
      }, intervalMs);
    };

    const startCycle = async () => {
      clearScheduledTimer();
      await runOnce();
      scheduleNext();
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.hidden) {
        clearScheduledTimer();
        abortInFlight();
      } else {
        startCycle();
      }
    };

    const handleCrossTabStorage = (event) => {
      if (!APP_CONFIG.useMocks) return;
      if (event.key && event.key !== MOCK_STORAGE_KEY) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      abortInFlight();
      startCycle();
    };

    startCycle();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined' && APP_CONFIG.useMocks) {
      window.addEventListener('storage', handleCrossTabStorage);
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearScheduledTimer();
      abortInFlight();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined' && APP_CONFIG.useMocks) {
        window.removeEventListener('storage', handleCrossTabStorage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, runOnce, ...deps]);

  const refetch = useCallback(async () => {
    abortInFlight();
    return runOnce();
  }, [runOnce]);

  return { data, error, loading, refreshing, lastUpdatedAt, refetch };
}
