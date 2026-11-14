import { useNow } from '@/hooks/useNow';
import { formatDurationFromMs } from '@/utils/formatters';

/** Exibe o tempo decorrido desde a entrada usando relógio local (sem requisições). */
export default function ElapsedTime({ entradaEm, endTime = null, className }) {
  const now = useNow(1000, !endTime);
  const startMs = new Date(entradaEm).getTime();
  const endMs = endTime ? new Date(endTime).getTime() : now;
  const diff = Number.isNaN(startMs) ? 0 : Math.max(0, endMs - startMs);

  return <span className={className}>{formatDurationFromMs(diff)}</span>;
}
