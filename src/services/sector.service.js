import { APP_CONFIG } from '@/config/app.config';
import { httpClient } from './api/httpClient';
import { ENDPOINTS } from './api/endpoints';
import { mapSectorDto } from './mappers/sector.mapper';
import { mapAdjustmentDto } from './mappers/history.mapper';
import { mockHandlers } from '@/mocks/handlers';

export const sectorService = {
  async list({ signal } = {}) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.listSectors({ signal });
    }
    const data = await httpClient.get(ENDPOINTS.sectors.list, { signal });
    return Array.isArray(data) ? data.map(mapSectorDto) : [];
  },

  async adjustOccupancy({ setorId, novaOcupacao, motivo, signal }) {
    if (APP_CONFIG.useMocks) {
      return mockHandlers.adjustSectorOccupancy({
        setorId,
        novaOcupacao,
        motivo,
        signal,
      });
    }
    const res = await httpClient.post(
      ENDPOINTS.sectors.adjustOccupancy(setorId),
      { novaOcupacao, motivo },
      { signal },
    );
    return {
      sector: mapSectorDto(res.sector),
      adjustment: mapAdjustmentDto(res.adjustment),
    };
  },
};
