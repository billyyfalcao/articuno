import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mapAdjustmentDto, mapEventDto, mapPaymentDto } from './mappers/history.mapper';
import { mockHandlers } from '@/mocks/handlers';

export const historyService = {
  async getHistory({ setorId, eventType, signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.listHistory({ setorId, eventType, signal });
    }
    const [events, payments, adjustments] = await Promise.all([
      httpClient.get(ENDPOINTS.history.events, {
        params: { setorId, eventType },
        signal,
      }),
      httpClient.get(ENDPOINTS.history.payments, { signal }),
      httpClient.get(ENDPOINTS.history.adjustments, {
        params: { setorId },
        signal,
      }),
    ]);

    return {
      events: Array.isArray(events) ? events.map(mapEventDto) : [],
      payments: Array.isArray(payments) ? payments.map(mapPaymentDto) : [],
      adjustments: Array.isArray(adjustments)
        ? adjustments.map(mapAdjustmentDto)
        : [],
    };
  },
};
