import { createInitialMockState } from './seed';

/**
 * Mock store centralizado em localStorage.
 *
 * Observação importante de arquitetura:
 *  - O localStorage é utilizado APENAS para simulação no mesmo navegador
 *    (permitindo demonstrar a interação entre duas abas: Admin e Motorista).
 *  - A sincronização entre dispositivos diferentes dependerá do backend oficial.
 */
export const MOCK_STORAGE_KEY = 'articuno_parking_mock_state_v3';

let memoryState = null;

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readState() {
  if (canUseLocalStorage()) {
    try {
      const raw = window.localStorage.getItem(MOCK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === 3 && Array.isArray(parsed.sectors)) {
          memoryState = parsed;
          return clone(parsed);
        }
      }
    } catch {
      // fallback para memória se o JSON estiver corrompido
    }
  }

  if (!memoryState) {
    memoryState = createInitialMockState();
    writeState(memoryState);
  }
  return clone(memoryState);
}

function writeState(nextState) {
  const stamped = {
    ...nextState,
    updatedAt: new Date().toISOString(),
  };
  memoryState = clone(stamped);

  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(stamped));
    } catch {
      // ignora quota exceeded em modo privado
    }
  }
  return clone(stamped);
}

export const mockStore = {
  getState: () => readState(),

  /**
   * Executa uma mutação atômica no estado simulado e persiste o resultado.
   */
  update: (mutator) => {
    const draft = readState();
    const result = mutator(draft);
    writeState(draft);
    return result !== undefined ? clone(result) : clone(draft);
  },

  /** Restaura o estado inicial de demonstração. */
  reset: () => {
    const initial = createInitialMockState();
    return writeState(initial);
  },
};
