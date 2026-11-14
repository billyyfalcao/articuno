/**
 * Constantes de domínio do Sistema de Estacionamento Inteligente.
 * Mantidas em um único ponto para garantir consistência entre Admin e Motorista.
 */

export const SESSION_STATUS = Object.freeze({
  ACTIVE: 'ATIVA',
  PAID: 'PAGA',
  FINISHED: 'FINALIZADA',
});

export const SESSION_STATUS_LABELS = Object.freeze({
  [SESSION_STATUS.ACTIVE]: 'Ativa',
  [SESSION_STATUS.PAID]: 'Paga (aguardando saída)',
  [SESSION_STATUS.FINISHED]: 'Finalizada',
});

export const EVENT_TYPE = Object.freeze({
  ENTRY: 'ENTRADA',
  MOVEMENT: 'MOVIMENTACAO',
  PAYMENT: 'PAGAMENTO',
  EXIT: 'SAIDA',
});

export const EVENT_TYPE_LABELS = Object.freeze({
  [EVENT_TYPE.ENTRY]: 'Entrada',
  [EVENT_TYPE.MOVEMENT]: 'Movimentação',
  [EVENT_TYPE.PAYMENT]: 'Pagamento simulado',
  [EVENT_TYPE.EXIT]: 'Saída',
});

export const PAYMENT_STATUS = Object.freeze({
  SIMULATED_APPROVED: 'SIMULADO_APROVADO',
});

export const PAYMENT_STATUS_LABELS = Object.freeze({
  [PAYMENT_STATUS.SIMULATED_APPROVED]: 'Simulado aprovado',
});

export const AVAILABILITY_LEVEL = Object.freeze({
  GREEN: 'VERDE',
  YELLOW: 'AMARELO',
  RED: 'VERMELHO',
});

export const AVAILABILITY_META = Object.freeze({
  [AVAILABILITY_LEVEL.GREEN]: {
    level: AVAILABILITY_LEVEL.GREEN,
    colorKey: 'green',
    label: 'Disponível',
    description: 'Acima de 40% de vagas livres',
    badgeVariant: 'success',
  },
  [AVAILABILITY_LEVEL.YELLOW]: {
    level: AVAILABILITY_LEVEL.YELLOW,
    colorKey: 'yellow',
    label: 'Moderado',
    description: 'Entre 20% e 40% de vagas livres',
    badgeVariant: 'warning',
  },
  [AVAILABILITY_LEVEL.RED]: {
    level: AVAILABILITY_LEVEL.RED,
    colorKey: 'red',
    label: 'Quase lotado',
    description: 'Até 20% de vagas livres',
    badgeVariant: 'danger',
  },
});

export const UNIDENTIFIED_PLATE_LABEL = 'Não identificada';
