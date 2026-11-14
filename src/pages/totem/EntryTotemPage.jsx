import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CameraOff,
  Car,
  CheckCircle2,
  Clock,
  Info,
  Map as MapIcon,
  MapPin,
  Navigation,
  Printer,
  QrCode,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import {
  TOTEM_ENTRY_BLOCK_REASON,
  TOTEM_STATE,
  TOTEM_STATE_META,
} from '@/domain/constants';
import { evaluateTotemEntryAvailability } from '@/domain/availability';
import {
  CAMERA_EVENT_TYPE,
  totemAttendanceFlow,
  totemCameraAdapter,
  totemPrinterAdapter,
} from '@/services/totemHardware.service';
import { useSectors } from '@/hooks/useSectors';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useNow } from '@/hooks/useNow';
import { formatDateTime, formatPlate } from '@/utils/formatters';
import Logo from '@/components/ui/Logo';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StateMessage from '@/components/ui/StateMessage';
import DemoBanner from '@/components/domain/DemoBanner';
import ParkingMap from '@/components/domain/ParkingMap';
import AvailabilityBadge from '@/components/domain/AvailabilityBadge';
import OccupancyBar from '@/components/domain/OccupancyBar';
import ThermalTicketPreview from '@/components/domain/ThermalTicketPreview';
import TotemDemoControls from '@/components/domain/TotemDemoControls';
import { cn } from '@/utils/cn';

const ATTENDANCE_FLOW_STEPS = [
  {
    key: 'vehicle',
    label: 'Chegada e Placa',
    states: [
      TOTEM_STATE.WAITING_VEHICLE,
      TOTEM_STATE.IDENTIFYING_PLATE,
      TOTEM_STATE.PLATE_IDENTIFIED,
      TOTEM_STATE.IDENTIFICATION_FAILED,
    ],
  },
  {
    key: 'ticket',
    label: 'Emissão do Ticket',
    states: [
      TOTEM_STATE.GENERATING_TICKET,
      TOTEM_STATE.TICKET_ISSUED,
      TOTEM_STATE.ISSUANCE_ERROR,
    ],
  },
  {
    key: 'print',
    label: 'Impressão e QR Code',
    states: [
      TOTEM_STATE.PREPARING_PRINT,
      TOTEM_STATE.PRINT_REQUESTED,
      TOTEM_STATE.PRINT_SIMULATED,
      TOTEM_STATE.PRINT_FAILED,
    ],
  },
];

const DRIVER_INSTRUCTIONS = [
  {
    step: 1,
    title: 'Confira as vagas disponíveis',
    description: 'Verifique a disponibilidade estimada em tempo real no painel.',
  },
  {
    step: 2,
    title: 'Identificação e Ticket',
    description: 'Aguarde a leitura da placa ou toque em emitir ticket.',
  },
  {
    step: 3,
    title: 'Observe o setor sugerido',
    description: 'Veja no mapa o setor com melhor disponibilidade e proximidade.',
  },
  {
    step: 4,
    title: 'Siga a sinalização',
    description: 'Dirija-se ao setor recomendado e guarde seu ticket digital.',
  },
];

/**
 * Totem Digital de Entrada (/totem/entrada)
 * Interface dedicada ao motorista para telas sensíveis ao toque, compartilhando
 * os mesmos serviços, estados e regras de negócio do ecossistema Articuno.
 */
export default function EntryTotemPage() {
  const sectorsState = useSectors({ polling: true });
  const recommendationsState = useRecommendations({ polling: true });
  const now = useNow(1000, true);

  const [totemState, setTotemState] = useState(TOTEM_STATE.WAITING_VEHICLE);
  const [detectedPlate, setDetectedPlate] = useState(null);
  const [issuedTicket, setIssuedTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [cameraAvailable, setCameraAvailable] = useState(() =>
    totemCameraAdapter.isAvailable(),
  );
  const [cameraReason, setCameraReason] = useState('');
  const [simulatePrintFailure, setSimulatePrintFailure] = useState(() =>
    totemPrinterAdapter.isSimulatingFailure(),
  );
  const [autoOpenPrintDialog, setAutoOpenPrintDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selectedMapSectorId, setSelectedMapSectorId] = useState(null);

  const autoResetSecondsConfig = APP_CONFIG.totem?.autoResetSeconds || 25;
  const [autoResetSecondsLeft, setAutoResetSecondsLeft] = useState(null);

  const issuedTicketRef = useRef(null);
  issuedTicketRef.current = issuedTicket;

  const availabilityOverview = useMemo(
    () =>
      evaluateTotemEntryAvailability(
        sectorsState.sectors,
        recommendationsState.recommendations,
      ),
    [sectorsState.sectors, recommendationsState.recommendations],
  );

  const {
    totalCapacity,
    totalOccupied,
    totalFree,
    occupancyPercent,
    enrichedSectors,
    recommendations,
    recommendedSector,
    entryConnectedIds,
    initialEntrySector,
    canIssueTicket,
    blockReason,
  } = availabilityOverview;

  const recommendedIds = useMemo(
    () => recommendations.map((rec) => rec.setorId),
    [recommendations],
  );

  const effectiveSelectedSectorId =
    selectedMapSectorId || recommendedSector?.setorId || enrichedSectors[0]?.id || null;

  const focusedSector = useMemo(
    () =>
      enrichedSectors.find((s) => s.id === effectiveSelectedSectorId) ||
      enrichedSectors.find((s) => s.id === recommendedSector?.setorId) ||
      null,
    [enrichedSectors, effectiveSelectedSectorId, recommendedSector],
  );

  const currentStateMeta =
    TOTEM_STATE_META[totemState] || TOTEM_STATE_META[TOTEM_STATE.WAITING_VEHICLE];

  const isLoadingInitial =
    (sectorsState.loading && enrichedSectors.length === 0) ||
    (recommendationsState.loading && recommendations.length === 0);

  const isRefreshing = sectorsState.refreshing || recommendationsState.refreshing;

  const refreshParkingData = useCallback(async () => {
    await Promise.all([sectorsState.refetch(), recommendationsState.refetch()]);
  }, [sectorsState, recommendationsState]);

  /**
   * Reinicia o totem para o próximo veículo, limpando integralmente dados do ticket
   * anterior e QR Code da tela (sem apagar a sessão registrada no armazenamento).
   */
  const handleResetAttendance = useCallback(() => {
    totemCameraAdapter.resetCooldown();
    setIssuedTicket(null);
    setDetectedPlate(null);
    setErrorMessage(null);
    setStatusFeedback(null);
    setAutoResetSecondsLeft(null);
    setTotemState(
      totemCameraAdapter.isAvailable()
        ? TOTEM_STATE.WAITING_VEHICLE
        : TOTEM_STATE.IDENTIFICATION_FAILED,
    );
  }, []);

  /**
   * Contagem regressiva de reinicialização automática após emissão do ticket,
   * evitando que o QR Code de um motorista permaneça exposto para o próximo veículo.
   */
  useEffect(() => {
    if (!issuedTicket) {
      setAutoResetSecondsLeft(null);
      return undefined;
    }

    setAutoResetSecondsLeft(autoResetSecondsConfig);
    const interval = setInterval(() => {
      setAutoResetSecondsLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          handleResetAttendance();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [issuedTicket, autoResetSecondsConfig, handleResetAttendance]);

  /**
   * Executa a emissão automática (quando a placa é lida) ou manual (sem placa).
   */
  const executeTicketIssuance = useCallback(
    async ({ mode, rawPlate = null }) => {
      if (totemAttendanceFlow.isBusy()) return;

      setBusy(true);
      setErrorMessage(null);

      try {
        const result = await totemAttendanceFlow.issueEntryTicket({
          mode,
          rawPlate,
          activeTicket: issuedTicketRef.current,
          openBrowserPrintDialog: autoOpenPrintDialog,
          onStateChange: (nextState, meta) => {
            setTotemState(nextState);
            if (meta?.plate !== undefined) {
              setDetectedPlate(meta.plate);
            }
            if (meta?.ticket) {
              setIssuedTicket(meta.ticket);
            }
            if (meta?.printResult) {
              setStatusFeedback(meta.printResult.message || meta.printResult.error || null);
            }
          },
        });

        if (!result.ok) {
          setErrorMessage(result.error);
          return;
        }

        await refreshParkingData();
      } finally {
        setBusy(false);
      }
    },
    [autoOpenPrintDialog, refreshParkingData],
  );

  /**
   * Solicita impressão ou reimpressão do MESMO ticket já emitido (mesmo token e sessão).
   */
  const handlePrintOrReprint = useCallback(
    async ({ openBrowserPrintDialog = true } = {}) => {
      if (!issuedTicket || printing) return;
      setPrinting(true);
      setErrorMessage(null);
      try {
        const res = await totemAttendanceFlow.reprintExistingTicket(issuedTicket, {
          openBrowserPrintDialog,
          onStateChange: (nextState, meta) => {
            setTotemState(nextState);
            if (meta?.printResult) {
              setStatusFeedback(meta.printResult.message || meta.printResult.error || null);
            }
          },
        });
        if (!res.ok && res.printResult?.error) {
          setStatusFeedback(res.printResult.error);
        }
      } finally {
        setPrinting(false);
      }
    },
    [issuedTicket, printing],
  );

  /**
   * Assina os eventos do adaptador de câmera (simulado no MVP ou câmera LPR real no futuro).
   */
  useEffect(() => {
    const unsubscribe = totemCameraAdapter.subscribe((event) => {
      if (event.type === CAMERA_EVENT_TYPE.CAMERA_AVAILABILITY) {
        setCameraAvailable(event.available);
        setCameraReason(event.reason || '');
        if (!event.available && !issuedTicketRef.current) {
          setTotemState(TOTEM_STATE.IDENTIFICATION_FAILED);
          setStatusFeedback(event.reason);
        } else if (event.available && !issuedTicketRef.current) {
          setTotemState(TOTEM_STATE.WAITING_VEHICLE);
          setStatusFeedback(null);
          setErrorMessage(null);
        }
        return;
      }

      // Ignora novos eventos de câmera se já houver um ticket emitido aguardando retirada
      if (issuedTicketRef.current || totemAttendanceFlow.isBusy()) {
        setStatusFeedback(
          'Atendimento em andamento: aguarde a finalização ou toque em "Novo atendimento" antes de processar outro veículo.',
        );
        return;
      }

      if (event.type === CAMERA_EVENT_TYPE.VEHICLE_APPROACH) {
        setDetectedPlate(null);
        setErrorMessage(null);
        setStatusFeedback(
          'Veículo posicionado na entrada. Realizando leitura óptica da placa...',
        );
        setTotemState(TOTEM_STATE.IDENTIFYING_PLATE);
        return;
      }

      if (event.type === CAMERA_EVENT_TYPE.OCR_FAILURE) {
        setDetectedPlate(null);
        setErrorMessage(null);
        setStatusFeedback(event.reason);
        setTotemState(TOTEM_STATE.IDENTIFICATION_FAILED);
        return;
      }

      if (event.type === CAMERA_EVENT_TYPE.PLATE_DETECTED) {
        if (event.isDuplicateFrame) {
          setStatusFeedback(
            `Leitura repetida da placa ${event.plate} ignorada automaticamente (proteção anti-duplicação).`,
          );
          return;
        }
        setDetectedPlate(event.plate || event.rawPlate || null);
        executeTicketIssuance({ mode: 'automatic', rawPlate: event.rawPlate });
      }
    });

    return unsubscribe;
  }, [executeTicketIssuance]);

  const handleManualTicketEmission = () => {
    if (busy || issuedTicket || !canIssueTicket) return;
    executeTicketIssuance({ mode: 'manual', rawPlate: null });
  };

  const handleFocusRecommendedSector = () => {
    if (recommendedSector?.setorId) {
      setSelectedMapSectorId(recommendedSector.setorId);
    }
  };

  const handleToggleCameraAvailability = () => {
    const nextAvailable = !cameraAvailable;
    totemCameraAdapter.setCameraAvailability(
      nextAvailable,
      nextAvailable
        ? 'Câmera LPR reconectada e operando normalmente.'
        : 'Câmera de leitura de placas indisponível. Emita seu ticket utilizando o botão manual.',
    );
  };

  const handleToggleSimulatePrintFailure = () => {
    const nextFail = totemPrinterAdapter.setSimulatePrintFailure(!simulatePrintFailure);
    setSimulatePrintFailure(nextFail);
  };

  const showManualEmissionButton =
    canIssueTicket &&
    !issuedTicket &&
    (totemState === TOTEM_STATE.IDENTIFICATION_FAILED ||
      !cameraAvailable ||
      totemState === TOTEM_STATE.ISSUANCE_ERROR);

  return (
    <div className="min-h-dvh flex flex-col bg-canvas text-slate-800 select-none">
      {/* Cabeçalho dedicado do Totem (oculto na impressão térmica) */}
      <header className="totem-no-print sticky top-0 z-20 border-b border-slate-200 bg-surface/95 px-4 py-3.5 shadow-2xs backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden h-7 w-px bg-slate-200 sm:block" aria-hidden="true" />
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                Totem de Orientação e Entrada
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block">
                Autoatendimento do Motorista · {APP_CONFIG.brand.team}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
                cameraAvailable
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                  : 'bg-amber-50 text-amber-900 ring-amber-300',
              )}
            >
              <span
                className={cn(
                  'size-2 rounded-full',
                  cameraAvailable ? 'bg-status-available' : 'bg-status-moderate',
                  isRefreshing && 'animate-ping',
                )}
              />
              <span>
                {cameraAvailable ? 'Monitoramento LPR ativo' : 'Modo contingência manual'}
              </span>
            </span>

            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/80">
              <Clock className="size-4 text-brand-700" aria-hidden="true" />
              <span>{formatDateTime(now)}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="totem-no-print">
        <DemoBanner variant="totem" />
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-8">
        {/* Saudação de boas-vindas centralizada */}
        <section className="totem-no-print mb-6 text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Bem-vindo ao {APP_CONFIG.brand.team}!
          </h2>
          <p className="mt-1.5 text-sm font-medium text-slate-600 sm:text-base">
            Consulte a disponibilidade estimada, veja o setor recomendado e retire seu ticket de
            entrada.
          </p>
        </section>

        {/* Controles de Demonstração (Exclusivos quando VITE_DEMO_MODE=true e VITE_USE_MOCKS=true) */}
        <div className="totem-no-print mb-6">
          <TotemDemoControls
            cameraAvailable={cameraAvailable}
            simulatePrintFailure={simulatePrintFailure}
            autoOpenPrintDialog={autoOpenPrintDialog}
            busy={busy || printing}
            totemState={totemState}
            onSimulateApproach={() => totemCameraAdapter.notifyVehicleApproach()}
            onSimulatePlateRead={(plate) => totemCameraAdapter.notifyPlateRead(plate)}
            onSimulateOcrFailure={() =>
              totemCameraAdapter.notifyOcrFailure(
                'Não foi possível identificar a placa do veículo pela câmera de entrada.',
              )
            }
            onToggleCameraAvailability={handleToggleCameraAvailability}
            onToggleSimulatePrintFailure={handleToggleSimulatePrintFailure}
            onToggleAutoOpenPrintDialog={setAutoOpenPrintDialog}
            onResetTotem={handleResetAttendance}
          />
        </div>

        {isLoadingInitial ? (
          <StateMessage
            variant="loading"
            title="Sincronizando dados do estacionamento..."
            description="Carregando disponibilidade estimada dos setores A até G e recomendações de entrada."
          />
        ) : sectorsState.error && enrichedSectors.length === 0 ? (
          <StateMessage
            variant="error"
            title="Indisponibilidade temporária de leitura dos setores"
            description={
              sectorsState.error.message ||
              'Não foi possível consultar os setores neste instante.'
            }
            action={
              <Button variant="primary" icon={RefreshCw} onClick={refreshParkingData}>
                Tentar novamente
              </Button>
            }
          />
        ) : (
          <>
            {/* Banner de bloqueio operacional quando não há vagas ou quando os setores de entrada estão cheios */}
            {blockReason === TOTEM_ENTRY_BLOCK_REASON.PARKING_FULL && (
              <div
                role="alert"
                className="totem-no-print mb-6 flex flex-col gap-3 rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-red-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-red-600 text-white">
                    <ShieldAlert className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-red-950 sm:text-lg">
                      Estacionamento com lotação máxima estimada
                    </h3>
                    <p className="mt-1 text-sm text-red-800">
                      No momento não existem vagas disponíveis estimadas nos setores A até G. A
                      emissão de novos tickets de entrada encontra-se temporariamente suspensa até
                      a liberação de vagas.
                    </p>
                  </div>
                </div>
                <Badge variant="danger" className="self-start sm:self-center">
                  0 vagas disponíveis
                </Badge>
              </div>
            )}

            {blockReason === TOTEM_ENTRY_BLOCK_REASON.ENTRY_SECTORS_FULL && (
              <div
                role="alert"
                className="totem-no-print mb-6 flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-600 text-white">
                    <AlertTriangle className="size-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-base font-extrabold text-amber-950 sm:text-lg">
                      Entrada automática indisponível no momento — Solicite atendimento
                    </h3>
                    <p className="mt-1 text-sm text-amber-900">
                      Os setores conectados diretamente ao ponto de entrada (Setores{' '}
                      {entryConnectedIds.join(' e ')}) atingiram a capacidade máxima estimada.
                      Embora existam cerca de <strong>{totalFree} vagas livres</strong> nos demais
                      setores, a entrada automática está bloqueada e será necessário atendimento
                      presencial para orientação de acesso.
                    </p>
                  </div>
                </div>
                <Badge variant="warning" className="self-start sm:self-center">
                  Necessário atendimento
                </Badge>
              </div>
            )}

            {/* Cards Superiores de Resumo (Vagas disponíveis + Setor sugerido) */}
            <section
              aria-label="Resumo rápido de disponibilidade e setor sugerido"
              className="totem-no-print mx-auto mb-6 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2"
            >
              {/* Card 1: Quantidade estimada de vagas disponíveis */}
              <div
                className={cn(
                  'flex items-center justify-between gap-4 rounded-2xl border p-5 shadow-card transition-all',
                  totalFree > 0
                    ? 'border-slate-200 bg-surface'
                    : 'border-red-300 bg-red-50/70',
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'grid size-14 shrink-0 place-items-center rounded-2xl ring-1',
                      totalFree > 0
                        ? 'bg-brand-50 text-brand-700 ring-brand-200'
                        : 'bg-red-100 text-red-700 ring-red-200',
                    )}
                  >
                    <Car className="size-7" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                      Vagas disponíveis (estimadas)
                    </p>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tight text-slate-900">
                        {totalFree}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">
                        de {totalCapacity} vagas ({100 - occupancyPercent}% livre)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {totalFree > 0 ? (
                    <span
                      className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
                      title="Vagas disponíveis no estacionamento"
                    >
                      <CheckCircle2 className="size-6" aria-hidden="true" />
                    </span>
                  ) : (
                    <Badge variant="danger">Lotado</Badge>
                  )}
                </div>
              </div>

              {/* Card 2: Setor recomendado (70% disponibilidade + 30% proximidade) */}
              <div
                className={cn(
                  'flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-card transition-all',
                  recommendedSector
                    ? 'border-emerald-300/90 bg-gradient-to-r from-emerald-50/90 via-emerald-50/50 to-surface'
                    : 'border-slate-200 bg-surface',
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'grid size-14 shrink-0 place-items-center rounded-2xl ring-1',
                      recommendedSector
                        ? 'bg-emerald-600 text-white ring-emerald-700'
                        : 'bg-slate-100 text-slate-500 ring-slate-200',
                    )}
                  >
                    <MapPin className="size-7" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold tracking-wide text-emerald-900/80 uppercase">
                      Setor sugerido
                    </p>
                    <div className="mt-0.5 flex items-baseline gap-2.5">
                      <span className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                        {recommendedSector ? recommendedSector.nome : 'Indisponível'}
                      </span>
                      {recommendedSector && (
                        <span className="text-xs font-bold text-emerald-800">
                          ≈ {recommendedSector.vagasLivresEstimadas} vagas livres
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {recommendedSector ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200/80 px-3 py-1 text-xs font-extrabold text-emerald-950">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      Maior disponibilidade relativa
                    </span>
                    <span className="text-[11px] font-medium text-slate-600">
                      {recommendedSector.freePercent}% livre · {recommendedSector.distanciaEntrada}{' '}
                      m da entrada
                    </span>
                  </div>
                ) : (
                  <Badge variant="danger">Sem setores livres</Badge>
                )}
              </div>
            </section>

            {/* Área Principal: Mapa Interativo (Esquerda) + Atendimento / Orientação (Direita) */}
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:items-start">
              {/* Coluna Esquerda (7/12): Visão dos setores A até G com ParkingMap reutilizado */}
              <div className="totem-no-print xl:col-span-7">
                <Card className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapIcon className="size-5 text-brand-700" aria-hidden="true" />
                      <h3 className="text-base font-extrabold text-slate-900">
                        Visão dos setores (A até G)
                      </h3>
                    </div>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      Toque em um setor para consultar detalhes
                    </span>
                  </div>

                  <ParkingMap
                    sectors={enrichedSectors}
                    recommendedIds={recommendedIds}
                    selectedSectorId={effectiveSelectedSectorId}
                    onSelectSector={(sector) => setSelectedMapSectorId(sector.id)}
                    showInspector={true}
                  />
                </Card>
              </div>

              {/* Coluna Direita (5/12): Status de Identificação / Emissão de Ticket + Orientação de Setor */}
              <div className="space-y-5 xl:col-span-5">
                {/* Card 1: Status da Identificação da Placa e Área de Emissão do Ticket */}
                <Card className="border-t-4 border-t-brand-700">
                  <div className="totem-no-print flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                        <Ticket className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          Atendimento e Emissão de Ticket
                        </h3>
                        <p className="text-xs text-slate-500">
                          Reconhecimento automático de placa e geração de ticket digital
                        </p>
                      </div>
                    </div>

                    <Badge variant={currentStateMeta.badgeVariant} dot>
                      {currentStateMeta.label}
                    </Badge>
                  </div>

                  {/* Indicador visual de etapas do atendimento */}
                  <div
                    aria-label="Etapas do atendimento no totem"
                    className="totem-no-print mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200/70"
                  >
                    {ATTENDANCE_FLOW_STEPS.map((step, idx) => {
                      const isActive = step.states.includes(totemState);
                      return (
                        <div
                          key={step.key}
                          className={cn(
                            'flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors',
                            isActive
                              ? 'bg-brand-700 text-white shadow-2xs'
                              : 'text-slate-500',
                          )}
                        >
                          <span
                            className={cn(
                              'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold',
                              isActive
                                ? 'bg-white text-brand-800'
                                : 'bg-slate-200 text-slate-600',
                            )}
                          >
                            {idx + 1}
                          </span>
                          <span className="truncate">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Painel de Status da Câmera LPR / Placa */}
                  <div className="totem-no-print mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'grid size-11 shrink-0 place-items-center rounded-xl text-white',
                            cameraAvailable ? 'bg-slate-900' : 'bg-amber-700',
                          )}
                        >
                          {cameraAvailable ? (
                            <Camera className="size-5 text-brand-300" aria-hidden="true" />
                          ) : (
                            <CameraOff className="size-5 text-amber-100" aria-hidden="true" />
                          )}
                        </span>
                        <div>
                          <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            Status da identificação da placa
                          </span>
                          <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                            {!cameraAvailable
                              ? 'Câmera indisponível (Contingência manual)'
                              : currentStateMeta.label}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                          Placa identificada
                        </span>
                        <div className="mt-0.5">
                          <span
                            className={cn(
                              'inline-flex rounded-xl px-3 py-1 font-mono text-sm font-extrabold tracking-widest ring-1',
                              issuedTicket
                                ? issuedTicket.placa
                                  ? 'bg-slate-900 text-white ring-slate-800'
                                  : 'bg-amber-100 text-amber-950 ring-amber-300 font-sans tracking-normal'
                                : detectedPlate
                                  ? 'bg-slate-900 text-white ring-slate-800'
                                  : 'bg-white text-slate-600 ring-slate-200 font-sans tracking-normal',
                            )}
                          >
                            {issuedTicket
                              ? formatPlate(issuedTicket.placa)
                              : detectedPlate
                                ? formatPlate(detectedPlate)
                                : 'Aguardando leitura'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-slate-600">
                      {!cameraAvailable && cameraReason
                        ? cameraReason
                        : statusFeedback || currentStateMeta.description}
                    </p>

                    {/* Informações claras sobre Setor Inicial (Cancela) vs Setor Recomendado */}
                    <div className="mt-3.5 grid grid-cols-1 gap-2 border-t border-slate-200/80 pt-3 text-xs sm:grid-cols-2">
                      <div className="rounded-xl bg-white p-2.5 ring-1 ring-slate-200/80">
                        <span className="text-[11px] font-semibold text-slate-500">
                          Acesso inicial conectado à entrada:
                        </span>
                        <p className="mt-0.5 font-extrabold text-slate-900">
                          {initialEntrySector
                            ? `${initialEntrySector.nome} (≈ ${initialEntrySector.vagasLivresEstimadas} vagas)`
                            : 'Sem capacidade nos setores de entrada'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-emerald-50/70 p-2.5 ring-1 ring-emerald-200/80">
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Setor recomendado para estacionar:
                        </span>
                        <p className="mt-0.5 font-extrabold text-emerald-950">
                          {recommendedSector
                            ? `${recommendedSector.nome} (${recommendedSector.freePercent}% livre)`
                            : 'Indisponível'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Alerta de erro de validação de placa ou duplicidade de sessão */}
                  {errorMessage && (
                    <div
                      role="alert"
                      className="totem-no-print mt-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-xs text-red-950"
                    >
                      <ShieldAlert
                        className="mt-0.5 size-5 shrink-0 text-red-600"
                        aria-hidden="true"
                      />
                      <div className="flex-1">
                        <p className="font-extrabold text-red-900">
                          Não foi possível emitir o ticket automaticamente
                        </p>
                        <p className="mt-1 leading-relaxed text-red-800">{errorMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Contingência: Falha na leitura OCR ou Câmera Indisponível -> Botão grande "Emitir ticket" */}
                  {showManualEmissionButton && (
                    <div className="totem-no-print mt-4 rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 text-center shadow-xs">
                      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-500 text-white shadow-2xs">
                        <Ticket className="size-6" aria-hidden="true" />
                      </span>
                      <h4 className="mt-3 text-base font-black text-amber-950">
                        {!cameraAvailable
                          ? 'Câmera temporariamente indisponível'
                          : 'Não foi possível identificar sua placa automaticamente'}
                      </h4>
                      <p className="mt-1 text-xs leading-relaxed text-amber-900">
                        Não se preocupe! Você não precisa digitar sua placa. Toque no botão abaixo
                        para emitir seu ticket com QR Code imediatamente.
                      </p>

                      <div className="mt-4">
                        <Button
                          variant="primary"
                          size="lg"
                          icon={Ticket}
                          loading={busy}
                          disabled={busy || !canIssueTicket}
                          onClick={handleManualTicketEmission}
                          className="w-full justify-center py-4 text-base font-black shadow-md"
                        >
                          Emitir ticket
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Confirmação de Ticket Emitido + Pré-visualização Térmica de 80 mm + QR Code */}
                  {issuedTicket ? (
                    <div className="mt-4 space-y-4">
                      <div className="totem-no-print rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <CheckCircle2
                              className="mt-0.5 size-5 shrink-0 text-emerald-600"
                              aria-hidden="true"
                            />
                            <div>
                              <h4 className="text-sm font-black text-emerald-950">
                                Entrada registrada com sucesso!
                              </h4>
                              <p className="mt-0.5 text-xs text-emerald-900">
                                Dirija-se preferencialmente ao{' '}
                                <strong>{issuedTicket.recommendedSectorName}</strong> (acesso pelo
                                Setor {issuedTicket.ultimoSetorId}).
                              </p>
                            </div>
                          </div>

                          {autoResetSecondsLeft !== null && (
                            <span className="shrink-0 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-emerald-900 ring-1 ring-emerald-300">
                              Reinicia em {autoResetSecondsLeft}s
                            </span>
                          )}
                        </div>
                      </div>

                      <ThermalTicketPreview
                        ticket={issuedTicket}
                        printState={totemState}
                        printFeedback={statusFeedback}
                        printing={printing}
                        onPrint={handlePrintOrReprint}
                      />

                      <div className="totem-no-print pt-2">
                        <Button
                          variant="secondary"
                          size="lg"
                          icon={RotateCcw}
                          onClick={handleResetAttendance}
                          className="w-full justify-center py-3.5 text-sm font-extrabold"
                        >
                          Novo atendimento (Concluir e limpar tela)
                        </Button>
                      </div>
                    </div>
                  ) : (
                    !showManualEmissionButton && (
                      <div className="totem-no-print mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-4">
                        <div className="flex items-start gap-3">
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                            <QrCode className="size-5" aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-extrabold text-slate-900">
                              Área de Emissão do Ticket Digital e Comprovante (80 mm)
                            </h4>
                            <p className="mt-1 text-xs text-slate-600">
                              {canIssueTicket
                                ? 'Posicione o veículo na faixa de leitura. Assim que a placa for identificada, a sessão será criada e seu ticket com QR Code será emitido automaticamente.'
                                : blockReason === TOTEM_ENTRY_BLOCK_REASON.PARKING_FULL
                                  ? 'Emissão bloqueada: o estacionamento atingiu 100% da ocupação estimada.'
                                  : 'Emissão automática bloqueada: os setores de entrada (A e B) estão sem vagas disponíveis. Solicite atendimento.'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Printer className="size-3.5 text-slate-400" aria-hidden="true" />
                            Impressora térmica 80 mm ·{' '}
                            {simulatePrintFailure ? 'Simulando falha' : 'Pronta para emissão'}
                          </span>
                          {totemState !== TOTEM_STATE.WAITING_VEHICLE && (
                            <button
                              type="button"
                              onClick={handleResetAttendance}
                              className="font-bold text-brand-700 hover:underline cursor-pointer"
                            >
                              Retornar ao estado inicial
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  )}
                </Card>

                {/* Card 2: Orientação de Setor (fiel à referência visual) */}
                <Card className="totem-no-print">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-5 text-brand-700" aria-hidden="true" />
                      <h3 className="text-base font-extrabold text-slate-900">
                        Orientação de setor
                      </h3>
                    </div>
                    {focusedSector && <AvailabilityBadge sector={focusedSector} />}
                  </div>

                  {focusedSector ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-slate-500">
                        {focusedSector.id === recommendedSector?.setorId
                          ? 'Setor recomendado (melhor índice de disponibilidade e proximidade)'
                          : 'Setor selecionado na planta para consulta'}
                      </p>

                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <span className="text-3xl font-black text-slate-900">
                          {focusedSector.nome}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
                          <Navigation className="size-3.5 text-brand-600" aria-hidden="true" />
                          {focusedSector.distanciaEntrada} m da entrada
                        </span>
                      </div>

                      <div className="mt-3">
                        <OccupancyBar sector={focusedSector} />
                      </div>

                      <div className="mt-2 flex items-center justify-between text-xs font-semibold text-slate-600">
                        <span className="text-emerald-700 font-bold">
                          ≈ {focusedSector.vagasLivresEstimadas} vagas livres
                        </span>
                        <span>{focusedSector.occupancyPercent}% ocupado</span>
                      </div>

                      {/* Ranking Top 3 de recomendação */}
                      {recommendations.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-3">
                          <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                            Melhores opções agora (70% vagas · 30% proximidade)
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {recommendations.map((rec, index) => {
                              const isSelected = focusedSector.id === rec.setorId;
                              return (
                                <button
                                  key={rec.setorId}
                                  type="button"
                                  onClick={() => setSelectedMapSectorId(rec.setorId)}
                                  className={cn(
                                    'flex flex-col items-start rounded-xl p-2.5 text-left transition-all cursor-pointer ring-1',
                                    isSelected
                                      ? 'bg-brand-950 text-white ring-brand-700 shadow-xs'
                                      : 'bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100',
                                  )}
                                >
                                  <div className="flex w-full items-center justify-between">
                                    <span className="text-xs font-extrabold">{rec.nome}</span>
                                    <span
                                      className={cn(
                                        'rounded px-1.5 py-0.5 text-[10px] font-black',
                                        isSelected
                                          ? 'bg-brand-500/30 text-brand-100'
                                          : 'bg-brand-100 text-brand-900',
                                      )}
                                    >
                                      #{index + 1}
                                    </span>
                                  </div>
                                  <span
                                    className={cn(
                                      'mt-1 text-[11px] font-semibold',
                                      isSelected ? 'text-brand-200' : 'text-emerald-700',
                                    )}
                                  >
                                    ≈ {rec.vagasLivresEstimadas} livres ({rec.freePercent}%)
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Nenhum setor disponível para recomendação no momento.
                    </p>
                  )}
                </Card>

                {/* Card 3: Como funciona (fiel à referência visual) */}
                <Card className="totem-no-print">
                  <div className="flex items-center gap-2">
                    <Info className="size-5 text-brand-700" aria-hidden="true" />
                    <h3 className="text-base font-extrabold text-slate-900">Como funciona</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    Critério de recomendação: <strong>70% disponibilidade proporcional</strong> e{' '}
                    <strong>30% proximidade da entrada</strong>. Os valores exibidos são
                    estimativas por setor (o sistema não monitora vagas individuais).
                  </p>
                  <div className="mt-3.5">
                    <Button
                      variant="primary"
                      size="lg"
                      icon={ArrowRight}
                      onClick={handleFocusRecommendedSector}
                      disabled={!recommendedSector}
                      className="w-full justify-center py-3 text-sm font-bold"
                    >
                      Destacar setor sugerido no mapa
                    </Button>
                  </div>
                </Card>
              </div>
            </section>

            {/* Barra Inferior de Passos para o Motorista (1 -> 2 -> 3 -> 4) */}
            <section
              aria-label="Instruções passo a passo para o motorista"
              className="totem-no-print mt-6 rounded-2xl border border-slate-200 bg-surface p-4 shadow-card sm:p-5"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {DRIVER_INSTRUCTIONS.map(({ step, title, description }) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-extrabold text-brand-800 ring-1 ring-brand-200">
                      {step}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ação rápida de atualização e nota informativa */}
            <div className="totem-no-print mt-5 flex flex-wrap items-center justify-center gap-4">
              <Button
                variant="primary"
                size="lg"
                icon={RefreshCw}
                loading={isRefreshing}
                onClick={refreshParkingData}
                className="px-6 py-3 font-bold shadow-sm"
              >
                Atualizar disponibilidade
              </Button>
              <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <ShieldCheck className="size-4 text-brand-700" aria-hidden="true" />
                Dados sincronizados automaticamente com o Painel e a Interface do Motorista (
                {totalOccupied}/{totalCapacity} vagas ocupadas)
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
