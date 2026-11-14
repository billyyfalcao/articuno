import { SECTORS_CONFIG, ENTRY_POINT, EXIT_POINT } from './sectors.config';
import { SESSION_STATUS, EVENT_TYPE, PAYMENT_STATUS } from '@/domain/constants';
import { computeExitDeadlineIso } from '@/domain/pricing';

/**
 * Tokens fixos de demonstração para facilitar testes imediatos do fluxo do motorista
 * (inclusive via links diretos), além dos tokens gerados aleatoriamente em novas entradas.
 * Todos possuem 22 caracteres em base64url (128 bits de entropia simulada).
 */
export const DEMO_TICKET_TOKENS = Object.freeze({
  ACTIVE_WITH_PLATE: 'JocC03Q-m_81Hr3XZ0IXvg',
  ACTIVE_UNIDENTIFIED: '9kLmP2vXr4Tz8Wq1Bn6YcA',
  PAID_WITHIN_WINDOW: '7vQpR5nZt2Yw9Lm4Kc8HdE',
  PAID_EXPIRED_WINDOW: '3xBnM8kLp1Qr6Tv9Wz2YfG',
});

const minutesAgoIso = (minutes, baseMs = Date.now()) =>
  new Date(baseMs - minutes * 60 * 1000).toISOString();

/**
 * Constrói o estado inicial consistente para os 7 setores (A–G), sessões,
 * eventos de movimentação, pagamentos e ajustes administrativos.
 *
 * Explicação operacional para a demonstração:
 *  - `monitoringStartedAt`: início do turno/janela de monitoramento (há 3 horas).
 *  - Todas as 5 sessões do turno possuem seu respectivo evento de ENTRADA registrado
 *    (5 entradas no turno e 1 saída concluída -> 4 sessões ativas/pagas ainda no pátio).
 *  - A ocupação estimada dos setores (170 vagas no total) reflete a carga inicial
 *    do pátio (ajustes de abertura de turno para demonstrar setores verdes, amarelos e
 *    vermelhos no mapa) somada às movimentações e ajustes administrativos subsequentes.
 */
export function createInitialMockState(referenceMs = Date.now()) {
  const monitoringStartedAt = minutesAgoIso(180, referenceMs);

  // Ocupações estimadas iniciais dos setores A–G para demonstrar as três faixas:
  // A (40): 34 ocupadas -> 15% livre (Vermelho)
  // B (35): 25 ocupadas -> 29% livre (Amarelo)
  // C (50): 18 ocupadas -> 64% livre (Verde)
  // D (45): 31 ocupadas -> 31% livre (Amarelo)
  // E (60): 20 ocupadas -> 67% livre (Verde)
  // F (55): 16 ocupadas -> 71% livre (Verde)
  // G (30): 26 ocupadas -> 13% livre (Vermelho)
  const initialOccupancyBySector = {
    A: 34,
    B: 25,
    C: 18,
    D: 31,
    E: 20,
    F: 16,
    G: 26,
  };

  // Carga base pré-existente na abertura do turno (antes das entradas individuais monitoradas):
  // 166 veículos pré-existentes + 5 entradas no turno - 1 saída = 170 vagas estimadas.
  const baselinePreExistingOccupancy = 166;

  const sectors = SECTORS_CONFIG.map((cfg) => ({
    id: cfg.id,
    nome: cfg.nome,
    capacidade: cfg.capacidade,
    ocupacaoEstimada: initialOccupancyBySector[cfg.id] ?? 0,
    distanciaEntrada: cfg.distanciaEntrada,
  }));

  const paidRecentAt = minutesAgoIso(4, referenceMs);
  const paidExpiredAt = minutesAgoIso(22, referenceMs);

  const sessions = [
    {
      id: 'SES-1001',
      placa: 'BRA2E19',
      entradaEm: minutesAgoIso(48, referenceMs),
      ultimoSetorId: 'C',
      ultimaDeteccaoEm: minutesAgoIso(12, referenceMs),
      status: SESSION_STATUS.ACTIVE,
      prazoSaidaEm: null,
    },
    {
      id: 'SES-1002',
      placa: null, // Placa não identificada
      entradaEm: minutesAgoIso(95, referenceMs),
      ultimoSetorId: 'E',
      ultimaDeteccaoEm: minutesAgoIso(19, referenceMs),
      status: SESSION_STATUS.ACTIVE,
      prazoSaidaEm: null,
    },
    {
      id: 'SES-1003',
      placa: 'ART4C20',
      entradaEm: minutesAgoIso(70, referenceMs),
      ultimoSetorId: 'A',
      ultimaDeteccaoEm: minutesAgoIso(5, referenceMs),
      status: SESSION_STATUS.PAID,
      prazoSaidaEm: computeExitDeadlineIso(paidRecentAt),
    },
    {
      id: 'SES-1004',
      placa: 'QWE9J81',
      entradaEm: minutesAgoIso(140, referenceMs),
      ultimoSetorId: 'B',
      ultimaDeteccaoEm: minutesAgoIso(25, referenceMs),
      status: SESSION_STATUS.PAID,
      prazoSaidaEm: computeExitDeadlineIso(paidExpiredAt), // Prazo de 15 min já expirado
    },
    {
      id: 'SES-1005',
      placa: 'MER1D23',
      entradaEm: minutesAgoIso(130, referenceMs),
      ultimoSetorId: 'A',
      ultimaDeteccaoEm: minutesAgoIso(35, referenceMs),
      status: SESSION_STATUS.FINISHED,
      prazoSaidaEm: minutesAgoIso(30, referenceMs),
    },
  ];

  const ticketAccess = {
    [DEMO_TICKET_TOKENS.ACTIVE_WITH_PLATE]: 'SES-1001',
    [DEMO_TICKET_TOKENS.ACTIVE_UNIDENTIFIED]: 'SES-1002',
    [DEMO_TICKET_TOKENS.PAID_WITHIN_WINDOW]: 'SES-1003',
    [DEMO_TICKET_TOKENS.PAID_EXPIRED_WINDOW]: 'SES-1004',
  };

  const payments = [
    {
      id: 'PAG-5001',
      sessaoId: 'SES-1003',
      valorCentavos: 900, // 1h10 -> R$ 6,00 + R$ 3,00
      status: PAYMENT_STATUS.SIMULATED_APPROVED,
      pagoEm: paidRecentAt,
    },
    {
      id: 'PAG-5002',
      sessaoId: 'SES-1004',
      valorCentavos: 900,
      status: PAYMENT_STATUS.SIMULATED_APPROVED,
      pagoEm: paidExpiredAt,
    },
    {
      id: 'PAG-5003',
      sessaoId: 'SES-1005',
      valorCentavos: 900,
      status: PAYMENT_STATUS.SIMULATED_APPROVED,
      pagoEm: minutesAgoIso(40, referenceMs),
    },
  ];

  // Todos os 5 veículos da lista de sessões possuem seu evento de ENTRADA correspondente
  // (5 ENTRADAS - 1 SAÍDA = 4 sessões presentes no pátio).
  const events = [
    {
      id: 'EVT-9010',
      sessaoId: 'SES-1003',
      tipo: EVENT_TYPE.PAYMENT,
      origem: 'A',
      destino: 'A',
      ocorridoEm: paidRecentAt,
    },
    {
      id: 'EVT-9009',
      sessaoId: 'SES-1001',
      tipo: EVENT_TYPE.MOVEMENT,
      origem: 'A',
      destino: 'C',
      ocorridoEm: minutesAgoIso(12, referenceMs),
    },
    {
      id: 'EVT-9008',
      sessaoId: 'SES-1002',
      tipo: EVENT_TYPE.MOVEMENT,
      origem: 'C',
      destino: 'E',
      ocorridoEm: minutesAgoIso(19, referenceMs),
    },
    {
      id: 'EVT-9007',
      sessaoId: 'SES-1004',
      tipo: EVENT_TYPE.PAYMENT,
      origem: 'B',
      destino: 'B',
      ocorridoEm: paidExpiredAt,
    },
    {
      id: 'EVT-9006',
      sessaoId: 'SES-1005',
      tipo: EVENT_TYPE.EXIT,
      origem: 'A',
      destino: EXIT_POINT,
      ocorridoEm: minutesAgoIso(35, referenceMs),
    },
    {
      id: 'EVT-9005',
      sessaoId: 'SES-1005',
      tipo: EVENT_TYPE.PAYMENT,
      origem: 'A',
      destino: 'A',
      ocorridoEm: minutesAgoIso(40, referenceMs),
    },
    {
      id: 'EVT-9004',
      sessaoId: 'SES-1001',
      tipo: EVENT_TYPE.ENTRY,
      origem: ENTRY_POINT,
      destino: 'A',
      ocorridoEm: minutesAgoIso(48, referenceMs),
    },
    {
      id: 'EVT-9003',
      sessaoId: 'SES-1003',
      tipo: EVENT_TYPE.ENTRY,
      origem: ENTRY_POINT,
      destino: 'A',
      ocorridoEm: minutesAgoIso(70, referenceMs),
    },
    {
      id: 'EVT-9002',
      sessaoId: 'SES-1002',
      tipo: EVENT_TYPE.ENTRY,
      origem: ENTRY_POINT,
      destino: 'A',
      ocorridoEm: minutesAgoIso(95, referenceMs),
    },
    {
      id: 'EVT-9001',
      sessaoId: 'SES-1005',
      tipo: EVENT_TYPE.ENTRY,
      origem: ENTRY_POINT,
      destino: 'A',
      ocorridoEm: minutesAgoIso(130, referenceMs),
    },
    {
      id: 'EVT-9000',
      sessaoId: 'SES-1004',
      tipo: EVENT_TYPE.ENTRY,
      origem: ENTRY_POINT,
      destino: 'B',
      ocorridoEm: minutesAgoIso(140, referenceMs),
    },
  ];

  const adjustments = [
    {
      id: 'AJU-3002',
      setorId: 'A',
      ocupacaoAnterior: 32,
      novaOcupacao: 34,
      motivo: 'Conferência visual na abertura do turno',
      ajustadoEm: minutesAgoIso(60, referenceMs),
    },
    {
      id: 'AJU-3001',
      setorId: 'G',
      ocupacaoAnterior: 24,
      novaOcupacao: 26,
      motivo: 'Calibração inicial de ocupação pré-existente no pátio (abertura do turno)',
      ajustadoEm: monitoringStartedAt,
    },
  ];

  return {
    version: 3,
    monitoringStartedAt,
    baselinePreExistingOccupancy,
    updatedAt: new Date(referenceMs).toISOString(),
    counters: {
      session: 1006,
      event: 9011,
      payment: 5004,
      adjustment: 3003,
    },
    sectors,
    sessions,
    events,
    payments,
    adjustments,
    ticketAccess,
  };
}
