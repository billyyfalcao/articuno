import { APP_CONFIG } from '@/config/app.config';
import {
  TOTEM_ENTRY_BLOCK_REASON,
  TOTEM_STATE,
} from '@/domain/constants';
import { evaluateTotemEntryAvailability } from '@/domain/availability';
import { sessionService } from './session.service';
import { sectorService } from './sector.service';
import { recommendationService } from './recommendation.service';
import { isValidVehiclePlate, normalizePlate } from '@/utils/plate';
import { isWellFormedToken } from '@/utils/token';

/**
 * Eventos padronizados da câmera de leitura de placas (LPR/OCR).
 * No futuro, o driver da câmera física ou WebSocket do backend emitirá
 * exatamente estes mesmos eventos para `totemCameraAdapter.emit(...)`.
 */
export const CAMERA_EVENT_TYPE = Object.freeze({
  VEHICLE_APPROACH: 'VEHICLE_APPROACH',
  PLATE_DETECTED: 'PLATE_DETECTED',
  OCR_FAILURE: 'OCR_FAILURE',
  CAMERA_AVAILABILITY: 'CAMERA_AVAILABILITY',
});

let cameraAvailable = true;
let cameraListeners = new Set();
let lastDetectedPlateRecord = { plate: null, timestampMs: 0 };

export const totemCameraAdapter = {
  isAvailable: () => cameraAvailable,

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    cameraListeners.add(listener);
    return () => {
      cameraListeners.delete(listener);
    };
  },

  emit(event) {
    const payload = {
      ...event,
      emittedAt: event?.emittedAt || new Date().toISOString(),
    };
    cameraListeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {
        // Isola falhas de listeners individuais
      }
    });
    return payload;
  },

  /**
   * Simula ou recebe o sinal do sensor de presença (laço indutivo / barreira óptica).
   */
  notifyVehicleApproach() {
    if (!cameraAvailable) {
      return this.emit({
        type: CAMERA_EVENT_TYPE.CAMERA_AVAILABILITY,
        available: false,
        reason:
          'Câmera de leitura de placas indisponível no momento. Utilize a emissão manual de ticket.',
      });
    }

    return this.emit({
      type: CAMERA_EVENT_TYPE.VEHICLE_APPROACH,
      available: true,
    });
  },

  /**
   * Recebe a leitura de uma placa (simulada no MVP ou oriunda de câmera LPR futura).
   * Inclui proteção contra quadros (frames) repetidos da mesma placa em curto intervalo.
   */
  notifyPlateRead(rawPlate, { bypassCooldown = false } = {}) {
    if (!cameraAvailable) {
      return this.emit({
        type: CAMERA_EVENT_TYPE.CAMERA_AVAILABILITY,
        available: false,
        reason:
          'A câmera está indisponível para leitura automática. Emita o ticket manualmente.',
      });
    }

    const normalized = normalizePlate(rawPlate);
    const validFormat = isValidVehiclePlate(normalized);
    const nowMs = Date.now();
    const cooldownMs = APP_CONFIG.totem?.duplicatePlateCooldownMs || 6000;

    const isDuplicateFrame =
      !bypassCooldown &&
      Boolean(normalized) &&
      lastDetectedPlateRecord.plate === normalized &&
      nowMs - lastDetectedPlateRecord.timestampMs < cooldownMs;

    if (normalized && validFormat && !isDuplicateFrame) {
      lastDetectedPlateRecord = { plate: normalized, timestampMs: nowMs };
    }

    return this.emit({
      type: CAMERA_EVENT_TYPE.PLATE_DETECTED,
      rawPlate: rawPlate ?? '',
      plate: normalized,
      validFormat,
      isDuplicateFrame,
    });
  },

  /**
   * Notifica que a câmera não conseguiu identificar os caracteres da placa (falha OCR).
   */
  notifyOcrFailure(
    reason = 'Não foi possível identificar a placa automaticamente na entrada.',
  ) {
    return this.emit({
      type: CAMERA_EVENT_TYPE.OCR_FAILURE,
      reason,
    });
  },

  /**
   * Altera o estado operacional da câmera (online / indisponível).
   */
  setCameraAvailability(available, reason = '') {
    cameraAvailable = Boolean(available);
    return this.emit({
      type: CAMERA_EVENT_TYPE.CAMERA_AVAILABILITY,
      available: cameraAvailable,
      reason:
        reason ||
        (cameraAvailable
          ? 'Câmera LPR online e pronta para leitura automática.'
          : 'Câmera de leitura de placas temporariamente indisponível.'),
    });
  },

  resetCooldown() {
    lastDetectedPlateRecord = { plate: null, timestampMs: 0 };
  },
};

/**
 * Adaptador de Impressora Térmica (80 mm).
 *
 * Responsabilidades:
 *  - Preparar o comprovante térmico de 80 mm para uma sessão JÁ criada.
 *  - Nunca criar sessão nem gerar novo token durante impressão ou reimpressão.
 *  - Diferenciar claramente entre:
 *      1. Ticket gerado (`TOTEM_STATE.TICKET_ISSUED`)
 *      2. Impressão solicitada (`TOTEM_STATE.PRINT_REQUESTED`)
 *      3. Impressão simulada (`TOTEM_STATE.PRINT_SIMULATED`)
 *      4. Falha na impressão (`TOTEM_STATE.PRINT_FAILED`)
 *  - Não assumir que a abertura de `window.print()` confirma papel impresso fisicamente.
 */
let simulateNextPrintFailure = false;

export const totemPrinterAdapter = {
  isSimulatingFailure: () => simulateNextPrintFailure,

  setSimulatePrintFailure(shouldFail) {
    simulateNextPrintFailure = Boolean(shouldFail);
    return simulateNextPrintFailure;
  },

  /**
   * Solicita a impressão ou reimpressão de um ticket existente.
   *
   * @param {object} ticket - Objeto do ticket emitido contendo `token`, `entradaEm`, etc.
   * @param {object} options
   * @param {boolean} [options.openBrowserPrintDialog=false] - Se true, aciona `window.print()`.
   */
  async printThermalTicket(ticket, { openBrowserPrintDialog = false } = {}) {
    if (!ticket || !isWellFormedToken(ticket.token)) {
      return {
        ok: false,
        printState: TOTEM_STATE.PRINT_FAILED,
        error: 'Dados do ticket inválidos para preparação de impressão.',
      };
    }

    if (simulateNextPrintFailure) {
      return {
        ok: false,
        printState: TOTEM_STATE.PRINT_FAILED,
        token: ticket.token,
        paperWidthMm: APP_CONFIG.totem?.thermalPaperWidthMm || 80,
        error:
          'Falha na comunicação com a impressora térmica de 80 mm (sem papel ou porta indisponível). Você pode solicitar a reimpressão do mesmo ticket ou escanear o QR Code na tela.',
      };
    }

    const canInvokeBrowserPrint =
      openBrowserPrintDialog &&
      typeof window !== 'undefined' &&
      typeof window.print === 'function';

    if (canInvokeBrowserPrint) {
      try {
        window.print();
        return {
          ok: true,
          printState: TOTEM_STATE.PRINT_REQUESTED,
          token: ticket.token,
          paperWidthMm: APP_CONFIG.totem?.thermalPaperWidthMm || 80,
          message:
            'Janela de impressão do navegador acionada. Atenção: a abertura do diálogo de impressão não confirma que o papel físico foi impresso.',
        };
      } catch {
        return {
          ok: false,
          printState: TOTEM_STATE.PRINT_FAILED,
          token: ticket.token,
          paperWidthMm: APP_CONFIG.totem?.thermalPaperWidthMm || 80,
          error:
            'O navegador bloqueou ou falhou ao abrir a janela de impressão. Utilize o botão "Reimprimir / Salvar PDF" abaixo.',
        };
      }
    }

    return {
      ok: true,
      printState: TOTEM_STATE.PRINT_SIMULATED,
      token: ticket.token,
      paperWidthMm: APP_CONFIG.totem?.thermalPaperWidthMm || 80,
      message:
        'Impressão térmica de 80 mm simulada em modo de demonstração. Utilize "Imprimir / Salvar PDF" para abrir o diálogo do navegador quando desejar.',
    };
  },
};

/**
 * Orquestrador do fluxo de emissão do Totem Digital de Entrada.
 *
 * Garantias arquiteturais:
 *  - Reutiliza `sessionService.simulateEntry` (não duplica lógica de criação de sessão).
 *  - Protege contra chamadas concorrentes (`issuanceInFlight`), cliques repetidos e
 *    tentativas de emissão enquanto um atendimento já possui ticket ativo na tela.
 *  - Diferencia setor inicial (conectado a ENTRADA: A ou B) de setor recomendado (70%/30%).
 *  - Garante que falha ou reimpressão utilize o mesmo ticket/token sem criar outra sessão.
 */
let issuanceInFlight = false;

export const totemAttendanceFlow = {
  isBusy: () => issuanceInFlight,

  /**
   * Executa a emissão de ticket (automática após leitura de placa ou manual sem placa).
   */
  async issueEntryTicket({
    mode = 'automatic', // 'automatic' | 'manual'
    rawPlate = null,
    activeTicket = null,
    openBrowserPrintDialog = false,
    onStateChange,
  } = {}) {
    if (issuanceInFlight) {
      return {
        ok: false,
        ignoredDuplicateTrigger: true,
        state: TOTEM_STATE.GENERATING_TICKET,
        error: 'Uma emissão de ticket já está em andamento. Aguarde a conclusão.',
      };
    }

    if (activeTicket && activeTicket.token) {
      return {
        ok: false,
        ignoredDuplicateTrigger: true,
        state: TOTEM_STATE.TICKET_ISSUED,
        ticket: activeTicket,
        error:
          'Este atendimento já possui um ticket emitido. Utilize a opção de reimpressão ou inicie um novo atendimento.',
      };
    }

    issuanceInFlight = true;

    try {
      let normalizedPlate = null;

      if (mode === 'automatic') {
        normalizedPlate = normalizePlate(rawPlate);
        if (!normalizedPlate || !isValidVehiclePlate(normalizedPlate)) {
          const invalidState = TOTEM_STATE.ISSUANCE_ERROR;
          onStateChange?.(invalidState);
          return {
            ok: false,
            state: invalidState,
            error: `Placa inválida (${rawPlate || 'vazia'}). O formato deve seguir o padrão Mercosul (AAA0A00) ou anterior (AAA0000).`,
          };
        }
        onStateChange?.(TOTEM_STATE.PLATE_IDENTIFIED, { plate: normalizedPlate });
      } else {
        normalizedPlate = null;
      }

      // 1. Consulta disponibilidade atualizada e recomendações pelos serviços existentes
      const [sectors, recommendations] = await Promise.all([
        sectorService.list(),
        recommendationService.list(),
      ]);
      const availability = evaluateTotemEntryAvailability(sectors, recommendations);

      if (!availability.canIssueTicket) {
        const blockedError =
          availability.blockReason === TOTEM_ENTRY_BLOCK_REASON.PARKING_FULL
            ? 'Estacionamento lotado: não há vagas disponíveis para emitir ticket de entrada.'
            : 'Entrada automática indisponível: os setores conectados ao ponto de entrada (A e B) estão sem capacidade disponível. Solicite atendimento.';
        onStateChange?.(TOTEM_STATE.ISSUANCE_ERROR);
        return {
          ok: false,
          state: TOTEM_STATE.ISSUANCE_ERROR,
          blockReason: availability.blockReason,
          error: blockedError,
        };
      }

      const setorInicialId = availability.initialEntrySector.setorId;
      const recommendedSector = availability.recommendedSector;

      // 2. Cria a sessão utilizando o sessionService existente
      onStateChange?.(TOTEM_STATE.GENERATING_TICKET);
      const createdSession = await sessionService.simulateEntry({
        placa: normalizedPlate,
        setorInicialId,
      });

      const issuedTicket = {
        sessionId: createdSession.id,
        token: createdSession.ticketToken,
        placa: createdSession.placa,
        entradaEm: createdSession.entradaEm,
        ultimoSetorId: createdSession.ultimoSetorId,
        recommendedSectorId: recommendedSector?.setorId || createdSession.ultimoSetorId,
        recommendedSectorName:
          recommendedSector?.nome || `Setor ${createdSession.ultimoSetorId}`,
      };

      onStateChange?.(TOTEM_STATE.TICKET_ISSUED, { ticket: issuedTicket });

      // 3. Prepara e solicita a impressão térmica de 80 mm
      onStateChange?.(TOTEM_STATE.PREPARING_PRINT, { ticket: issuedTicket });
      const printResult = await totemPrinterAdapter.printThermalTicket(issuedTicket, {
        openBrowserPrintDialog,
      });

      onStateChange?.(printResult.printState, {
        ticket: issuedTicket,
        printResult,
      });

      return {
        ok: true,
        state: printResult.printState,
        ticket: issuedTicket,
        printResult,
      };
    } catch (err) {
      onStateChange?.(TOTEM_STATE.ISSUANCE_ERROR);
      return {
        ok: false,
        state: TOTEM_STATE.ISSUANCE_ERROR,
        status: err?.status || 500,
        error:
          err?.message ||
          'Não foi possível criar a sessão de entrada. Tente novamente ou solicite atendimento.',
      };
    } finally {
      issuanceInFlight = false;
    }
  },

  /**
   * Solicita uma nova impressão (reimpressão) do MESMO ticket já emitido,
   * sem criar outra sessão e sem gerar novo token.
   */
  async reprintExistingTicket(
    existingTicket,
    { openBrowserPrintDialog = true, onStateChange } = {},
  ) {
    if (!existingTicket || !isWellFormedToken(existingTicket.token)) {
      return {
        ok: false,
        state: TOTEM_STATE.PRINT_FAILED,
        error: 'Nenhum ticket válido disponível para reimpressão.',
      };
    }

    onStateChange?.(TOTEM_STATE.PREPARING_PRINT, { ticket: existingTicket });
    const printResult = await totemPrinterAdapter.printThermalTicket(existingTicket, {
      openBrowserPrintDialog,
    });
    onStateChange?.(printResult.printState, {
      ticket: existingTicket,
      printResult,
    });

    return {
      ok: printResult.ok,
      state: printResult.printState,
      ticket: existingTicket,
      printResult,
    };
  },
};

