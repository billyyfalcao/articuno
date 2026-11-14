import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mapSectorDto } from './mappers/sector.mapper';
import { mapEventDto } from './mappers/history.mapper';
import { mapSessionDto } from './mappers/session.mapper';
import { mockHandlers } from '@/mocks/handlers';

export const dashboardService = {
  async getOverview({ signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.getDashboardOverview({ signal });
    }
    const data = await httpClient.get(ENDPOINTS.dashboard.overview, { signal });
    return {
      updatedAt: data.updatedAt,
      kpis: data.kpis,
      sectors: Array.isArray(data.sectors) ? data.sectors.map(mapSectorDto) : [],
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      recentEvents: Array.isArray(data.recentEvents)
        ? data.recentEvents.map(mapEventDto)
        : [],
      activeTickets: Array.isArray(data.activeTickets)
        ? data.activeTickets.map(mapSessionDto)
        : [],
    };
  },
};
