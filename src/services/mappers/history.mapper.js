export function mapEventDto(dto = {}) {
  return {
    id: dto.id,
    sessaoId: dto.sessaoId ?? dto.session_id,
    tipo: dto.tipo ?? dto.type,
    origem: dto.origem ?? dto.origin,
    destino: dto.destino ?? dto.destination,
    ocorridoEm: dto.ocorridoEm ?? dto.occurred_at,
  };
}

export function mapPaymentDto(dto = {}) {
  return {
    id: dto.id,
    sessaoId: dto.sessaoId ?? dto.session_id,
    valorCentavos: Number(dto.valorCentavos ?? dto.amount_cents ?? 0),
    status: dto.status,
    pagoEm: dto.pagoEm ?? dto.paid_at,
  };
}

export function mapAdjustmentDto(dto = {}) {
  return {
    id: dto.id,
    setorId: dto.setorId ?? dto.sector_id,
    ocupacaoAnterior: Number(dto.ocupacaoAnterior ?? dto.previous_occupancy ?? 0),
    novaOcupacao: Number(dto.novaOcupacao ?? dto.new_occupancy ?? 0),
    motivo: dto.motivo ?? dto.reason ?? '',
    ajustadoEm: dto.ajustadoEm ?? dto.adjusted_at,
  };
}
