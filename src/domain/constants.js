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

/**
 * Estados claros do ciclo de atendimento do Totem Digital de Entrada.
 */
export const TOTEM_STATE = Object.freeze({
  WAITING_VEHICLE: 'AGUARDANDO_VEICULO',
  IDENTIFYING_PLATE: 'IDENTIFICANDO_PLACA',
  PLATE_IDENTIFIED: 'PLACA_IDENTIFICADA',
  IDENTIFICATION_FAILED: 'FALHA_IDENTIFICACAO',
  GENERATING_TICKET: 'GERANDO_TICKET',
  TICKET_ISSUED: 'TICKET_EMITIDO',
  PREPARING_PRINT: 'PREPARANDO_IMPRESSAO',
  PRINT_REQUESTED: 'IMPRESSAO_SOLICITADA',
  PRINT_SIMULATED: 'IMPRESSAO_SIMULADA',
  PRINT_FAILED: 'FALHA_IMPRESSAO',
  ISSUANCE_ERROR: 'ERRO_EMISSAO',
});

export const TOTEM_STATE_META = Object.freeze({
  [TOTEM_STATE.WAITING_VEHICLE]: {
    label: 'Aguardando veículo',
    description: 'Posicione o veículo em frente ao sensor de entrada para leitura automática da placa.',
    badgeVariant: 'info',
  },
  [TOTEM_STATE.IDENTIFYING_PLATE]: {
    label: 'Identificando placa',
    description: 'Câmera de entrada realizando leitura automática da placa do veículo...',
    badgeVariant: 'info',
  },
  [TOTEM_STATE.PLATE_IDENTIFIED]: {
    label: 'Placa identificada',
    description: 'Placa reconhecida com sucesso. Preparando registro de entrada...',
    badgeVariant: 'success',
  },
  [TOTEM_STATE.IDENTIFICATION_FAILED]: {
    label: 'Falha na identificação',
    description: 'Não foi possível identificar a placa automaticamente. Toque em "Emitir ticket" para prosseguir.',
    badgeVariant: 'warning',
  },
  [TOTEM_STATE.GENERATING_TICKET]: {
    label: 'Gerando ticket',
    description: 'Registrando sessão de entrada e gerando token seguro do ticket...',
    badgeVariant: 'info',
  },
  [TOTEM_STATE.TICKET_ISSUED]: {
    label: 'Ticket emitido',
    description: 'Sessão criada e ticket digital disponível para acesso via QR Code.',
    badgeVariant: 'success',
  },
  [TOTEM_STATE.PREPARING_PRINT]: {
    label: 'Preparando impressão',
    description: 'Formatando comprovante térmico de 80 mm para impressão...',
    badgeVariant: 'info',
  },
  [TOTEM_STATE.PRINT_REQUESTED]: {
    label: 'Impressão solicitada',
    description: 'Solicitação enviada para a janela de impressão do sistema. Retire seu ticket ou escaneie o QR Code.',
    badgeVariant: 'success',
  },
  [TOTEM_STATE.PRINT_SIMULATED]: {
    label: 'Impressão simulada',
    description: 'Comprovante térmico preparado em modo demonstração. Você pode imprimir no navegador, salvar em PDF ou escanear o QR Code.',
    badgeVariant: 'info',
  },
  [TOTEM_STATE.PRINT_FAILED]: {
    label: 'Falha na impressão',
    description: 'Não foi possível acionar a impressora térmica. Solicite a reimpressão do mesmo ticket ou escaneie o QR Code na tela.',
    badgeVariant: 'warning',
  },
  [TOTEM_STATE.ISSUANCE_ERROR]: {
    label: 'Erro na emissão',
    description: 'Não foi possível concluir a emissão do ticket para esta entrada.',
    badgeVariant: 'danger',
  },
});

export const TOTEM_ENTRY_BLOCK_REASON = Object.freeze({
  NONE: null,
  PARKING_FULL: 'ESTACIONAMENTO_LOTADO',
  ENTRY_SECTORS_FULL: 'SETORES_ENTRADA_SEM_CAPACIDADE',
});
