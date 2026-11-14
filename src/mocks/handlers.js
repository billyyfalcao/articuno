import { mockStore } from './store';
import { ENTRY_POINT, EXIT_POINT, SECTOR_CONNECTIONS } from './sectors.config';
import { SESSION_STATUS, EVENT_TYPE, PAYMENT_STATUS } from '@/domain/constants';
import { computeSectorAvailability, rankSectorRecommendations } from '@/domain/availability';
import {
  calculateEstimatedTariff,
  computeExitDeadlineIso,
  evaluateExitAuthorization,
} from '@/domain/pricing';
import { generateTicketToken, isWellFormedToken } from '@/utils/token';
import { ApiError } from '@/services/api/ApiError';

/** Simula latência curta de rede e respeita cancelamento via AbortSignal. */
function simulateNetworkDelay(signal, ms = 120) {
  if (signal?.aborted) {
    const err = new Error('Requisição cancelada');
    err.name = 'AbortError';
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          const err = new Error('Requisição cancelada');
          err.name = 'AbortError';
          reject(err);
        },
        { once: true },
      );
    }
  });
}

/** Verifica se existe conexão física direta entre dois pontos em SECTOR_CONNECTIONS. */
export function areNodesConnected(origin, destination) {
  return SECTOR_CONNECTIONS.some(
    ([a, b]) => (a === origin && b === destination) || (b === origin && a === destination),
  );
}

/** Retorna os vizinhos conectados a um setor/ponto. */
export function getConnectedNeighbors(node) {
  const neighbors = [];
  for (const [a, b] of SECTOR_CONNECTIONS) {
    if (a === node) neighbors.push(b);
    else if (b === node) neighbors.push(a);
  }
  return neighbors;
}

function findTokenBySessionId(ticketAccess, sessionId) {
  for (const [token, sId] of Object.entries(ticketAccess || {})) {
    if (sId === sessionId) return token;
  }
  return null;
}

function enrichSessionForAdmin(session, state) {
  const payment = state.payments.find((p) => p.sessaoId === session.id) || null;
  const tariff = calculateEstimatedTariff(
    session.entradaEm,
    payment?.pagoEm ? new Date(payment.pagoEm).getTime() : Date.now(),
  );
  const exitAuth = evaluateExitAuthorization(session);
  const token = findTokenBySessionId(state.ticketAccess, session.id);
  const events = state.events.filter((e) => e.sessaoId === session.id);

  return {
    ...session,
    valorEstimadoCentavos: payment?.valorCentavos ?? tariff.totalCents,
    pagamento: payment,
    autorizacaoSaidaValida: exitAuth.isAuthorizationValid,
    requerRegularizacao: exitAuth.requiresRegularization,
    ticketToken: token,
    eventos: events,
    vizinhosConectados: getConnectedNeighbors(session.ultimoSetorId).filter(
      (node) => node !== ENTRY_POINT && node !== EXIT_POINT,
    ),
    conectadoASaida: areNodesConnected(session.ultimoSetorId, EXIT_POINT),
  };
}

export const mockHandlers = {
  async listSectors({ signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();
    return state.sectors.map((s) => ({
      ...s,
      ...computeSectorAvailability(s),
    }));
  },

  async adjustSectorOccupancy({ setorId, novaOcupacao, motivo, signal } = {}) {
    await simulateNetworkDelay(signal);
    if (!motivo || !String(motivo).trim()) {
      throw new ApiError('O motivo do ajuste é obrigatório para auditoria.', 400);
    }

    return mockStore.update((draft) => {
      const sector = draft.sectors.find((s) => s.id === setorId);
      if (!sector) {
        throw new ApiError(`Setor ${setorId} não encontrado.`, 404);
      }

      const parsed = Number(novaOcupacao);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > sector.capacidade) {
        throw new ApiError(
          `A ocupação deve estar entre 0 e ${sector.capacidade}.`,
          400,
        );
      }

      const adjustment = {
        id: `AJU-${draft.counters.adjustment++}`,
        setorId: sector.id,
        ocupacaoAnterior: sector.ocupacaoEstimada,
        novaOcupacao: parsed,
        motivo: String(motivo).trim(),
        ajustadoEm: new Date().toISOString(),
      };

      sector.ocupacaoEstimada = parsed;
      draft.adjustments.unshift(adjustment);

      return {
        sector: { ...sector, ...computeSectorAvailability(sector) },
        adjustment,
      };
    });
  },

  async listRecommendations({ signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();
    return rankSectorRecommendations(state.sectors);
  },

  async listSessions({ status, search, setorId, signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();
    const normalizedSearch = search ? String(search).trim().toUpperCase() : '';

    return state.sessions
      .filter((s) => (!status || status === 'TODOS' ? true : s.status === status))
      .filter((s) => (!setorId || setorId === 'TODOS' ? true : s.ultimoSetorId === setorId))
      .filter((s) => {
        if (!normalizedSearch) return true;
        const plateText = s.placa ? s.placa.toUpperCase() : 'NAO IDENTIFICADA';
        return (
          plateText.includes(normalizedSearch) ||
          s.id.toUpperCase().includes(normalizedSearch)
        );
      })
      .map((s) => enrichSessionForAdmin(s, state));
  },

  async getSessionDetails({ sessaoId, signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();
    const session = state.sessions.find((s) => s.id === sessaoId);
    if (!session) {
      throw new ApiError(`Sessão ${sessaoId} não encontrada.`, 404);
    }
    return enrichSessionForAdmin(session, state);
  },

  async getDashboardOverview({ signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();
    const sectors = state.sectors.map((s) => ({
      ...s,
      ...computeSectorAvailability(s),
    }));

    const totalCapacity = sectors.reduce((acc, s) => acc + s.capacidade, 0);
    const totalOccupied = sectors.reduce((acc, s) => acc + s.ocupacaoEstimada, 0);
    const totalFree = Math.max(0, totalCapacity - totalOccupied);
    const occupancyPercent =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    const activeSessions = state.sessions.filter(
      (s) => s.status === SESSION_STATUS.ACTIVE,
    ).length;
    const paidAwaitingExit = state.sessions.filter(
      (s) => s.status === SESSION_STATUS.PAID,
    ).length;
    const presentVehicles = activeSessions + paidAwaitingExit;

    const totalEntries = state.events.filter(
      (e) => e.tipo === EVENT_TYPE.ENTRY,
    ).length;
    const totalExits = state.events.filter(
      (e) => e.tipo === EVENT_TYPE.EXIT,
    ).length;

    return {
      updatedAt: state.updatedAt,
      monitoringStartedAt: state.monitoringStartedAt || null,
      kpis: {
        capacidadeTotal: totalCapacity,
        ocupacaoEstimadaTotal: totalOccupied,
        cargaBasePreExistente: state.baselinePreExistingOccupancy ?? 0,
        vagasLivresEstimadas: totalFree,
        percentualOcupacaoGeral: occupancyPercent,
        veiculosPresentes: presentVehicles,
        sessoesAtivas: activeSessions,
        pagasAguardandoSaida: paidAwaitingExit,
        totalEntradas: totalEntries,
        totalSaidas: totalExits,
        inicioMonitoramentoEm: state.monitoringStartedAt || null,
      },
      sectors,
      recommendations: rankSectorRecommendations(state.sectors),
      recentEvents: state.events.slice(0, 8),
      activeTickets: state.sessions
        .filter((s) => s.status !== SESSION_STATUS.FINISHED)
        .map((s) => enrichSessionForAdmin(s, state)),
    };
  },

  async listHistory({ setorId, eventType, signal } = {}) {
    await simulateNetworkDelay(signal);
    const state = mockStore.getState();

    const events = state.events.filter((evt) => {
      const matchType = !eventType || eventType === 'TODOS' || evt.tipo === eventType;
      const matchSector =
        !setorId ||
        setorId === 'TODOS' ||
        evt.origem === setorId ||
        evt.destino === setorId;
      return matchType && matchSector;
    });

    const adjustments = state.adjustments.filter((adj) =>
      !setorId || setorId === 'TODOS' ? true : adj.setorId === setorId,
    );

    const payments = state.payments
      .filter((pay) => {
        if (!setorId || setorId === 'TODOS') return true;
        const sess = state.sessions.find((s) => s.id === pay.sessaoId);
        return sess?.ultimoSetorId === setorId;
      })
      .map((pay) => {
        const sess = state.sessions.find((s) => s.id === pay.sessaoId);
        return {
          ...pay,
          placa: sess?.placa || null,
          setorId: sess?.ultimoSetorId || '—',
        };
      });

    return {
      events,
      payments,
      adjustments,
    };
  },

  async getTicketByToken({ token, signal } = {}) {
    await simulateNetworkDelay(signal);
    if (!isWellFormedToken(token)) {
      throw new ApiError('Ticket não encontrado ou expirado.', 404);
    }

    const state = mockStore.getState();
    const sessionId = state.ticketAccess?.[token];
    const session = sessionId
      ? state.sessions.find((s) => s.id === sessionId)
      : null;

    if (!session || session.status === SESSION_STATUS.FINISHED) {
      throw new ApiError('Ticket não encontrado ou expirado.', 404);
    }

    const sector = state.sectors.find((s) => s.id === session.ultimoSetorId) || null;
    const payment = state.payments.find((p) => p.sessaoId === session.id) || null;
    const tariff = calculateEstimatedTariff(
      session.entradaEm,
      payment?.pagoEm ? new Date(payment.pagoEm).getTime() : Date.now(),
    );
    const exitAuth = evaluateExitAuthorization(session);

    return {
      token,
      placa: session.placa,
      entradaEm: session.entradaEm,
      ultimoSetorId: session.ultimoSetorId,
      ultimoSetorNome: sector?.nome || `Setor ${session.ultimoSetorId}`,
      ultimaDeteccaoEm: session.ultimaDeteccaoEm,
      status: session.status,
      prazoSaidaEm: session.prazoSaidaEm,
      valorEstimadoCentavos: payment?.valorCentavos ?? tariff.totalCents,
      pagamento: payment
        ? {
            valorCentavos: payment.valorCentavos,
            status: payment.status,
            pagoEm: payment.pagoEm,
          }
        : null,
      autorizacaoSaida: exitAuth,
      sectors: state.sectors.map((s) => ({
        ...s,
        ...computeSectorAvailability(s),
      })),
    };
  },

  async simulateTicketPayment({ token, signal } = {}) {
    await simulateNetworkDelay(signal);
    if (!isWellFormedToken(token)) {
      throw new ApiError('Ticket não encontrado ou expirado.', 404);
    }

    mockStore.update((draft) => {
      const sessionId = draft.ticketAccess?.[token];
      const session = sessionId
        ? draft.sessions.find((s) => s.id === sessionId)
        : null;

      if (!session || session.status === SESSION_STATUS.FINISHED) {
        throw new ApiError('Ticket não encontrado ou expirado.', 404);
      }

      const existingPayment = draft.payments.find((p) => p.sessaoId === session.id);
      if (session.status === SESSION_STATUS.PAID && existingPayment) {
        return;
      }

      const nowIso = new Date().toISOString();
      const tariff = calculateEstimatedTariff(session.entradaEm, Date.now());

      const payment = {
        id: `PAG-${draft.counters.payment++}`,
        sessaoId: session.id,
        valorCentavos: tariff.totalCents,
        status: PAYMENT_STATUS.SIMULATED_APPROVED,
        pagoEm: nowIso,
      };

      session.status = SESSION_STATUS.PAID;
      session.prazoSaidaEm = computeExitDeadlineIso(nowIso);

      draft.payments.unshift(payment);
      draft.events.unshift({
        id: `EVT-${draft.counters.event++}`,
        sessaoId: session.id,
        tipo: EVENT_TYPE.PAYMENT,
        origem: session.ultimoSetorId,
        destino: session.ultimoSetorId,
        ocorridoEm: nowIso,
      });
    });

    return this.getTicketByToken({ token, signal });
  },

  async simulateVehicleEntry({ placa = null, setorInicialId = 'A', signal } = {}) {
    await simulateNetworkDelay(signal);
    if (!areNodesConnected(ENTRY_POINT, setorInicialId)) {
      throw new ApiError(
        `O setor ${setorInicialId} não possui conexão direta com a entrada (apenas setores A e B).`,
        400,
      );
    }

    return mockStore.update((draft) => {
      const sector = draft.sectors.find((s) => s.id === setorInicialId);
      if (!sector) throw new ApiError('Setor inicial inválido.', 400);
      if (sector.ocupacaoEstimada >= sector.capacidade) {
        throw new ApiError(`O ${sector.nome} está com ocupação máxima estimada.`, 400);
      }

      const normalizedPlate =
        placa && String(placa).trim() ? String(placa).trim().toUpperCase() : null;

      if (normalizedPlate) {
        const duplicateInYard = draft.sessions.find(
          (s) =>
            s.status !== SESSION_STATUS.FINISHED &&
            s.placa &&
            s.placa.toUpperCase() === normalizedPlate,
        );
        if (duplicateInYard) {
          throw new ApiError(
            `Operação duplicada negada: o veículo de placa ${normalizedPlate} já possui uma sessão em andamento (${duplicateInYard.id}).`,
            409,
          );
        }
      }

      const nowIso = new Date().toISOString();
      const sessionId = `SES-${draft.counters.session++}`;
      const token = generateTicketToken();

      const session = {
        id: sessionId,
        placa: normalizedPlate,
        entradaEm: nowIso,
        ultimoSetorId: sector.id,
        ultimaDeteccaoEm: nowIso,
        status: SESSION_STATUS.ACTIVE,
        prazoSaidaEm: null,
      };

      sector.ocupacaoEstimada = Math.min(sector.capacidade, sector.ocupacaoEstimada + 1);
      draft.sessions.unshift(session);
      draft.ticketAccess[token] = sessionId;
      draft.events.unshift({
        id: `EVT-${draft.counters.event++}`,
        sessaoId: sessionId,
        tipo: EVENT_TYPE.ENTRY,
        origem: ENTRY_POINT,
        destino: sector.id,
        ocorridoEm: nowIso,
      });

      return enrichSessionForAdmin(session, draft);
    });
  },

  async simulateVehicleMovement({ sessaoId, destinoSetorId, signal } = {}) {
    await simulateNetworkDelay(signal);
    return mockStore.update((draft) => {
      const session = draft.sessions.find((s) => s.id === sessaoId);
      if (!session || session.status === SESSION_STATUS.FINISHED) {
        throw new ApiError('Sessão não disponível para movimentação.', 400);
      }

      if (session.ultimoSetorId === destinoSetorId) {
        throw new ApiError(
          `O veículo já se encontra no Setor ${destinoSetorId}.`,
          400,
        );
      }

      if (!areNodesConnected(session.ultimoSetorId, destinoSetorId)) {
        throw new ApiError(
          `Movimentação inválida: não há conexão física direta entre o Setor ${session.ultimoSetorId} e o Setor ${destinoSetorId}.`,
          400,
        );
      }

      const originSector = draft.sectors.find((s) => s.id === session.ultimoSetorId);
      const targetSector = draft.sectors.find((s) => s.id === destinoSetorId);
      if (!targetSector) throw new ApiError('Setor de destino inválido.', 400);
      if (targetSector.ocupacaoEstimada >= targetSector.capacidade) {
        throw new ApiError(`O ${targetSector.nome} atingiu a capacidade estimada.`, 400);
      }

      const nowIso = new Date().toISOString();
      if (originSector) {
        originSector.ocupacaoEstimada = Math.max(0, originSector.ocupacaoEstimada - 1);
      }
      targetSector.ocupacaoEstimada = Math.min(
        targetSector.capacidade,
        targetSector.ocupacaoEstimada + 1,
      );

      const previousSectorId = session.ultimoSetorId;
      session.ultimoSetorId = targetSector.id;
      session.ultimaDeteccaoEm = nowIso;

      draft.events.unshift({
        id: `EVT-${draft.counters.event++}`,
        sessaoId: session.id,
        tipo: EVENT_TYPE.MOVEMENT,
        origem: previousSectorId,
        destino: targetSector.id,
        ocorridoEm: nowIso,
      });

      return enrichSessionForAdmin(session, draft);
    });
  },

  async simulateVehicleExit({ sessaoId, signal } = {}) {
    await simulateNetworkDelay(signal);
    return mockStore.update((draft) => {
      const session = draft.sessions.find((s) => s.id === sessaoId);
      if (!session) {
        throw new ApiError('Sessão não encontrada.', 404);
      }
      if (session.status === SESSION_STATUS.FINISHED) {
        throw new ApiError('Esta sessão já foi finalizada.', 400);
      }
      if (session.status !== SESSION_STATUS.PAID) {
        throw new ApiError(
          'Saída negada: a sessão ainda não possui pagamento registrado.',
          400,
        );
      }

      const exitAuth = evaluateExitAuthorization(session);
      if (!exitAuth.isAuthorizationValid) {
        throw new ApiError(
          'Saída negada: o prazo de 15 minutos após o pagamento expirou. Regularização necessária.',
          400,
        );
      }

      if (!areNodesConnected(session.ultimoSetorId, EXIT_POINT)) {
        throw new ApiError(
          `Saída negada: o veículo está no Setor ${session.ultimoSetorId}, que não possui conexão direta com a saída (mova-o até os setores A ou B).`,
          400,
        );
      }

      const sector = draft.sectors.find((s) => s.id === session.ultimoSetorId);
      if (sector) {
        sector.ocupacaoEstimada = Math.max(0, sector.ocupacaoEstimada - 1);
      }

      const nowIso = new Date().toISOString();
      session.status = SESSION_STATUS.FINISHED;
      session.ultimaDeteccaoEm = nowIso;

      draft.events.unshift({
        id: `EVT-${draft.counters.event++}`,
        sessaoId: session.id,
        tipo: EVENT_TYPE.EXIT,
        origem: session.ultimoSetorId,
        destino: EXIT_POINT,
        ocorridoEm: nowIso,
      });

      return enrichSessionForAdmin(session, draft);
    });
  },
};
