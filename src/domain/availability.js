import { APP_CONFIG } from '@/config/app.config';
import { ENTRY_POINT, SECTOR_CONNECTIONS } from '@/mocks/sectors.config';
import {
  AVAILABILITY_LEVEL,
  AVAILABILITY_META,
  TOTEM_ENTRY_BLOCK_REASON,
} from './constants';

/**
 * Regras de disponibilidade e ocupação estimada dos setores.
 *
 * Faixas de disponibilidade por proporção de vagas LIVRES:
 *  - Vermelho: 0% a 20% livres (<= 0.20)
 *  - Amarelo:  acima de 20% até 40% (<= 0.40)
 *  - Verde:    acima de 40% (> 0.40)
 */
export function computeSectorAvailability(sector) {
  const capacidade = Math.max(1, Number(sector?.capacidade) || 1);
  const ocupacaoEstimada = Math.max(
    0,
    Math.min(capacidade, Math.round(Number(sector?.ocupacaoEstimada) || 0)),
  );
  const vagasLivresEstimadas = Math.max(0, capacidade - ocupacaoEstimada);
  const freeRatio = vagasLivresEstimadas / capacidade;
  const occupancyRatio = ocupacaoEstimada / capacidade;

  const { redMaxFreeRatio, yellowMaxFreeRatio } = APP_CONFIG.availability;

  let level = AVAILABILITY_LEVEL.GREEN;
  if (freeRatio <= redMaxFreeRatio) {
    level = AVAILABILITY_LEVEL.RED;
  } else if (freeRatio <= yellowMaxFreeRatio) {
    level = AVAILABILITY_LEVEL.YELLOW;
  }

  return {
    capacidade,
    ocupacaoEstimada,
    vagasLivresEstimadas,
    freeRatio,
    occupancyRatio,
    freePercent: Math.round(freeRatio * 100),
    occupancyPercent: Math.round(occupancyRatio * 100),
    level,
    meta: AVAILABILITY_META[level],
  };
}

/**
 * Cálculo demonstrativo de recomendação de setores:
 *   70% disponibilidade proporcional + 30% proximidade da entrada.
 *
 * No futuro, o cálculo definitivo será realizado pelo backend oficial.
 */
export function rankSectorRecommendations(sectors = [], limit = APP_CONFIG.recommendation.topN) {
  if (!Array.isArray(sectors) || sectors.length === 0) return [];

  const maxDistance = Math.max(
    1,
    ...sectors.map((s) => Number(s.distanciaEntrada) || 0),
  );
  const { availabilityWeight, proximityWeight } = APP_CONFIG.recommendation;

  return sectors
    .map((sector) => {
      const availability = computeSectorAvailability(sector);
      const distance = Math.max(0, Number(sector.distanciaEntrada) || 0);
      const proximityScore = 1 - distance / maxDistance;
      const score =
        availabilityWeight * availability.freeRatio +
        proximityWeight * proximityScore;

      return {
        setorId: sector.id,
        nome: sector.nome,
        distanciaEntrada: distance,
        capacidade: availability.capacidade,
        ocupacaoEstimada: availability.ocupacaoEstimada,
        vagasLivresEstimadas: availability.vagasLivresEstimadas,
        freeRatio: availability.freeRatio,
        freePercent: availability.freePercent,
        level: availability.level,
        availabilityMeta: availability.meta,
        proximityScore,
        score: Number(score.toFixed(4)),
        scorePercent: Math.round(score * 100),
      };
    })
    .filter((item) => item.vagasLivresEstimadas > 0)
    .sort((a, b) => b.score - a.score || a.distanciaEntrada - b.distanciaEntrada)
    .slice(0, limit);
}

/**
 * Retorna os IDs dos setores fisicamente conectados ao ponto de entrada (ENTRADA),
 * preservando integralmente SECTOR_CONNECTIONS.
 */
export function getEntryConnectedSectorIds() {
  const connected = [];
  for (const [origin, destination] of SECTOR_CONNECTIONS) {
    if (origin === ENTRY_POINT && !connected.includes(destination)) {
      connected.push(destination);
    } else if (destination === ENTRY_POINT && !connected.includes(origin)) {
      connected.push(origin);
    }
  }
  return connected;
}

/**
 * Avalia a disponibilidade geral do estacionamento para o Totem Digital de Entrada,
 * separando claramente:
 *  - `recommendedSector`: melhor setor geral para estacionar (70% vagas + 30% proximidade)
 *  - `initialEntrySector`: setor de passagem na cancela conectado a ENTRADA (ex.: A ou B)
 *  - `canIssueTicket` / `blockReason`: impede emissão caso não haja vagas no estacionamento
 *    ou caso todos os setores conectados à entrada estejam sem capacidade disponível.
 */
export function evaluateTotemEntryAvailability(sectors = [], recommendations = null) {
  const enrichedSectors = (Array.isArray(sectors) ? sectors : []).map((sector) => ({
    ...sector,
    ...computeSectorAvailability(sector),
  }));

  const totalCapacity = enrichedSectors.reduce((acc, s) => acc + s.capacidade, 0);
  const totalOccupied = enrichedSectors.reduce((acc, s) => acc + s.ocupacaoEstimada, 0);
  const totalFree = Math.max(0, totalCapacity - totalOccupied);
  const occupancyPercent =
    totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

  const rankedAll = rankSectorRecommendations(enrichedSectors, enrichedSectors.length || 7);
  const topRecommendations =
    Array.isArray(recommendations) && recommendations.length > 0
      ? recommendations
      : rankedAll.slice(0, APP_CONFIG.recommendation.topN);

  const recommendedSector = topRecommendations[0] || rankedAll[0] || null;

  const entryConnectedIds = getEntryConnectedSectorIds();
  const entryConnectedSectors = enrichedSectors.filter((s) =>
    entryConnectedIds.includes(s.id),
  );
  const availableEntrySectors = rankedAll.filter((rec) =>
    entryConnectedIds.includes(rec.setorId),
  );

  const initialEntrySector = availableEntrySectors[0] || null;

  let blockReason = TOTEM_ENTRY_BLOCK_REASON.NONE;
  if (enrichedSectors.length > 0 && totalFree <= 0) {
    blockReason = TOTEM_ENTRY_BLOCK_REASON.PARKING_FULL;
  } else if (enrichedSectors.length > 0 && !initialEntrySector) {
    blockReason = TOTEM_ENTRY_BLOCK_REASON.ENTRY_SECTORS_FULL;
  }

  return {
    totalCapacity,
    totalOccupied,
    totalFree,
    occupancyPercent,
    enrichedSectors,
    recommendations: topRecommendations,
    recommendedSector,
    entryConnectedIds,
    entryConnectedSectors,
    initialEntrySector,
    canIssueTicket: enrichedSectors.length > 0 && blockReason === TOTEM_ENTRY_BLOCK_REASON.NONE,
    blockReason,
  };
}
