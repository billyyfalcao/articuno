import { mockStore } from './store';
import { areNodesConnected, getConnectedNeighbors, mockHandlers } from './handlers';
import { ENTRY_POINT, EXIT_POINT } from './sectors.config';
import { SESSION_STATUS } from '@/domain/constants';
import { evaluateExitAuthorization } from '@/domain/pricing';

const SAMPLE_PLATES = [
  'BRA3A12',
  'ART7F90',
  'GDM4K55',
  'PKM8N21',
  'RTY5J09',
  null, // simula veículos sem placa identificada
];

let autoSimulatorTimer = null;
const listeners = new Set();

function notifyListeners() {
  const running = Boolean(autoSimulatorTimer);
  listeners.forEach((fn) => fn(running));
}

/**
 * Executa um passo de simulação respeitando as conexões físicas entre setores
 * definidas em `sectors.config.js` (SECTOR_CONNECTIONS).
 */
export async function runSimulationStep() {
  const state = mockStore.getState();
  const activeSessions = state.sessions.filter(
    (s) => s.status === SESSION_STATUS.ACTIVE,
  );
  const paidSessions = state.sessions.filter(
    (s) => s.status === SESSION_STATUS.PAID,
  );

  // 1. Se houver sessão PAGA com autorização válida num setor conectado à SAÍDA (A ou B), conclui a saída
  const readyToExit = paidSessions.find(
    (s) =>
      evaluateExitAuthorization(s).isAuthorizationValid &&
      areNodesConnected(s.ultimoSetorId, EXIT_POINT),
  );

  if (readyToExit) {
    await mockHandlers.simulateVehicleExit({ sessaoId: readyToExit.id });
    return {
      action: 'SAIDA',
      sessaoId: readyToExit.id,
      origem: readyToExit.ultimoSetorId,
      destino: EXIT_POINT,
    };
  }

  // 2. Movimenta uma sessão ativa ou paga (dentro do prazo) para um setor vizinho conectado
  const movableSessions = [
    ...activeSessions,
    ...paidSessions.filter((s) => evaluateExitAuthorization(s).isAuthorizationValid),
  ];

  if (movableSessions.length > 0 && Math.random() < 0.7) {
    const candidate =
      movableSessions[Math.floor(Math.random() * movableSessions.length)];
    const validSectorNeighbors = getConnectedNeighbors(candidate.ultimoSetorId)
      .filter((node) => node !== ENTRY_POINT && node !== EXIT_POINT)
      .filter((sectorId) => {
        const sec = state.sectors.find((s) => s.id === sectorId);
        return sec && sec.ocupacaoEstimada < sec.capacidade;
      });

    if (validSectorNeighbors.length > 0) {
      const targetSectorId =
        validSectorNeighbors[Math.floor(Math.random() * validSectorNeighbors.length)];
      await mockHandlers.simulateVehicleMovement({
        sessaoId: candidate.id,
        destinoSetorId: targetSectorId,
      });
      return {
        action: 'MOVIMENTACAO',
        sessaoId: candidate.id,
        origem: candidate.ultimoSetorId,
        destino: targetSectorId,
      };
    }
  }

  // 3. Caso contrário, simula nova entrada por um setor conectado à ENTRADA (A ou B)
  const entrySectors = getConnectedNeighbors(ENTRY_POINT).filter((sectorId) => {
    const sec = state.sectors.find((s) => s.id === sectorId);
    return sec && sec.ocupacaoEstimada < sec.capacidade;
  });

  if (entrySectors.length > 0) {
    const setorInicialId =
      entrySectors[Math.floor(Math.random() * entrySectors.length)];
    const placa = SAMPLE_PLATES[Math.floor(Math.random() * SAMPLE_PLATES.length)];
    const created = await mockHandlers.simulateVehicleEntry({ placa, setorInicialId });
    return { action: 'ENTRADA', sessaoId: created.id, destino: setorInicialId };
  }

  return { action: 'NENHUMA' };
}

export const autoSimulator = {
  isRunning: () => Boolean(autoSimulatorTimer),

  start(intervalMs = 3500) {
    if (autoSimulatorTimer) return;
    autoSimulatorTimer = setInterval(() => {
      runSimulationStep().catch(() => {
        // ignora conflitos pontuais durante simulação automática
      });
    }, intervalMs);
    notifyListeners();
  },

  stop() {
    if (!autoSimulatorTimer) return;
    clearInterval(autoSimulatorTimer);
    autoSimulatorTimer = null;
    notifyListeners();
  },

  toggle(intervalMs = 3500) {
    if (autoSimulatorTimer) {
      this.stop();
      return false;
    }
    this.start(intervalMs);
    return true;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
