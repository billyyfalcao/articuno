import { SESSION_STATUS } from '@/domain/constants';
import { calculateEstimatedTariff, evaluateExitAuthorization } from '@/domain/pricing';

/** Mapeia DTO de sessão administrativa ou pública do ticket para o modelo do frontend. */
export function mapSessionDto(dto = {}) {
  const session = {
    id: dto.id ?? dto.session_id,
    placa: dto.placa ?? dto.plate ?? null,
    entradaEm: dto.entradaEm ?? dto.entered_at,
    ultimoSetorId: dto.ultimoSetorId ?? dto.last_sector_id,
    ultimaDeteccaoEm: dto.ultimaDeteccaoEm ?? dto.last_detected_at,
    status: dto.status ?? SESSION_STATUS.ACTIVE,
    prazoSaidaEm: dto.prazoSaidaEm ?? dto.exit_deadline_at ?? null,
  };

  const tariff = calculateEstimatedTariff(session.entradaEm);
  const exitAuth = evaluateExitAuthorization(session);

  return {
    ...session,
    valorEstimadoCentavos:
      dto.valorEstimadoCentavos ?? dto.estimated_amount_cents ?? tariff.totalCents,
    pagamento: dto.pagamento ?? dto.payment ?? null,
    autorizacaoSaidaValida:
      dto.autorizacaoSaidaValida ?? exitAuth.isAuthorizationValid,
    requerRegularizacao:
      dto.requerRegularizacao ?? exitAuth.requiresRegularization,
    ticketToken: dto.ticketToken ?? null,
  };
}

export function mapPublicTicketDto(dto = {}) {
  const exitAuth =
    dto.autorizacaoSaida ??
    evaluateExitAuthorization({
      status: dto.status,
      prazoSaidaEm: dto.prazoSaidaEm ?? dto.exit_deadline_at,
    });

  return {
    token: dto.token,
    placa: dto.placa ?? dto.plate ?? null,
    entradaEm: dto.entradaEm ?? dto.entered_at,
    ultimoSetorId: dto.ultimoSetorId ?? dto.last_sector_id,
    ultimoSetorNome:
      dto.ultimoSetorNome ?? dto.last_sector_name ?? `Setor ${dto.ultimoSetorId ?? ''}`,
    ultimaDeteccaoEm: dto.ultimaDeteccaoEm ?? dto.last_detected_at,
    status: dto.status ?? SESSION_STATUS.ACTIVE,
    prazoSaidaEm: dto.prazoSaidaEm ?? dto.exit_deadline_at ?? null,
    valorEstimadoCentavos:
      dto.valorEstimadoCentavos ?? dto.estimated_amount_cents ?? 0,
    pagamento: dto.pagamento ?? dto.payment ?? null,
    autorizacaoSaida: exitAuth,
    sectors: Array.isArray(dto.sectors) ? dto.sectors : [],
  };
}
