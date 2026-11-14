import { computeSectorAvailability } from '@/domain/availability';

/** Isola o modelo do frontend de eventuais variações de nomenclatura do backend (DTO -> Domain). */
export function mapSectorDto(dto = {}) {
  const base = {
    id: dto.id ?? dto.sector_id,
    nome: dto.nome ?? dto.name ?? `Setor ${dto.id ?? ''}`,
    capacidade: Number(dto.capacidade ?? dto.capacity ?? 0),
    ocupacaoEstimada: Number(dto.ocupacaoEstimada ?? dto.estimated_occupancy ?? 0),
    distanciaEntrada: Number(dto.distanciaEntrada ?? dto.distance_from_entry ?? 0),
  };
  return {
    ...base,
    ...computeSectorAvailability(base),
  };
}
