import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mapPublicTicketDto } from './mappers/session.mapper';
import { mockHandlers } from '@/mocks/handlers';

/**
 * Serviço público do motorista.
 * Opera exclusivamente com base no `:token` opaco, sem busca por ID ou placa.
 */
export const ticketService = {
  async getByToken(token, { signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.getTicketByToken({ token, signal });
    }
    const data = await httpClient.get(ENDPOINTS.tickets.byToken(token), { signal });
    return mapPublicTicketDto(data);
  },

  async simulatePayment(token, { signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.simulateTicketPayment({ token, signal });
    }
    const data = await httpClient.post(
      ENDPOINTS.tickets.simulatePayment(token),
      {},
      { signal },
    );
    return mapPublicTicketDto(data);
  },
};
