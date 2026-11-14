import { useEffect, useState } from 'react';

/**
 * Relógio local reativo para cronômetros de tela (tempo decorrido, prazo de saída),
 * sem disparar requisições de rede.
 */
export function useNow(intervalMs = 1000, enabled = true) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return now;
}
