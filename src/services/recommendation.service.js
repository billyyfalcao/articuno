import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mockHandlers } from '@/mocks/handlers';

export const recommendationService = {
  async list({ signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.listRecommendations({ signal });
    }
    return httpClient.get(ENDPOINTS.sectors.recommendations, { signal });
  },
};
