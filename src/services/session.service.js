import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mapSessionDto } from './mappers/session.mapper';
import { mockHandlers } from '@/mocks/handlers';
import { mockStore } from '@/mocks/store';
import { autoSimulator, runSimulationStep } from '@/mocks/simulator';

export const sessionService = {
  async list({ status, search, setorId, signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.listSessions({ status, search, setorId, signal });
    }
    const data = await httpClient.get(ENDPOINTS.sessions.list, {
      params: { status, search, setorId },
      signal,
    });
    return Array.isArray(data) ? data.map(mapSessionDto) : [];
  },

  async getById(sessaoId, { signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.getSessionDetails({ sessaoId, signal });
    }
    const data = await httpClient.get(
      `${ENDPOINTS.sessions.list}/${encodeURIComponent(sessaoId)}`,
      { signal },
    );
    return mapSessionDto(data);
  },

  /**
   * Operações exclusivas de demonstração local (ativas apenas quando VITE_USE_MOCKS=true).
   */
  async simulateEntry({ placa = null, setorInicialId = 'A', signal } = {}) {
    return mockHandlers.simulateVehicleEntry({ placa, setorInicialId, signal });
  },

  async simulateMovement({ sessaoId, destinoSetorId, signal } = {}) {
    return mockHandlers.simulateVehicleMovement({ sessaoId, destinoSetorId, signal });
  },

  async simulateExit({ sessaoId, signal } = {}) {
    return mockHandlers.simulateVehicleExit({ sessaoId, signal });
  },

  async runAutoStep() {
    return runSimulationStep();
  },

  resetDemoState() {
    autoSimulator.stop();
    return mockStore.reset();
  },

  autoSimulator,
};
