import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  FlaskConical,
  LogIn,
  LogOut,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { sessionService } from '@/services/session.service';
import { buildTicketPath } from '@/routes/paths';
import { formatPlate } from '@/utils/formatters';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';

/**
 * Painel discreto de controles de simulação (exclusivo quando VITE_USE_MOCKS=true).
 * Não replica regras de negócio: delega integralmente ao sessionService.
 */
const generateDemoPlate = () => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const pick = (str) => str[Math.floor(Math.random() * str.length)];
  return `ART${pick(digits)}${pick(letters)}${pick(digits)}${pick(digits)}`;
};

export default function DemoSimulatorControls({ activeTickets = [], onActionComplete }) {
  const [placaInput, setPlacaInput] = useState(() => generateDemoPlate());
  const [entrySectorId, setEntrySectorId] = useState('A');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [targetSectorId, setTargetSectorId] = useState('');
  const [exitSessionId, setExitSessionId] = useState('');
  const [autoRunning, setAutoRunning] = useState(() =>
    sessionService.autoSimulator.isRunning(),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const unsubscribe = sessionService.autoSimulator.subscribe((running) => {
      setAutoRunning(running);
    });
    return unsubscribe;
  }, []);

  // Mantém seleção sincronizada com sessões ativas disponíveis
  const selectedSession =
    activeTickets.find((s) => s.id === selectedSessionId) || activeTickets[0] || null;
  const effectiveSessionId = selectedSession?.id || '';
  const neighbors = selectedSession?.vizinhosConectados || [];
  const effectiveTargetSector =
    neighbors.includes(targetSectorId) ? targetSectorId : (neighbors[0] || '');

  const effectiveExitSessionId =
    activeTickets.find((s) => s.id === exitSessionId)?.id ||
    activeTickets[0]?.id ||
    '';

  if (!APP_CONFIG.useMocks) return null;

  const runAction = async (fn, successMsg) => {
    setBusy(true);
    setFeedback(null);
    try {
      const result = await fn();
      setFeedback({
        type: 'success',
        message: typeof successMsg === 'function' ? successMsg(result) : successMsg,
        ticketToken: result?.ticketToken || null,
      });
      await onActionComplete?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Não foi possível executar a simulação.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleEntryWithPlate = () =>
    runAction(
      async () => {
        const created = await sessionService.simulateEntry({
          placa: placaInput || generateDemoPlate(),
          setorInicialId: entrySectorId,
        });
        setPlacaInput(generateDemoPlate());
        return created;
      },
      (created) =>
        `Entrada simulada: sessão ${created.id} (${formatPlate(created.placa)}) no Setor ${created.ultimoSetorId}.`,
    );

  const handleEntryUnidentified = () =>
    runAction(
      () =>
        sessionService.simulateEntry({
          placa: null,
          setorInicialId: entrySectorId,
        }),
      (created) =>
        `Entrada com falha de leitura de placa registrada: sessão ${created.id} (Não identificada) no Setor ${created.ultimoSetorId}.`,
    );

  const handleMove = () => {
    if (!effectiveSessionId || !effectiveTargetSector) return;
    runAction(
      () =>
        sessionService.simulateMovement({
          sessaoId: effectiveSessionId,
          destinoSetorId: effectiveTargetSector,
        }),
      (updated) =>
        `Movimentação registrada: ${updated.id} deslocou-se para o Setor ${updated.ultimoSetorId}.`,
    );
  };

  const handleExit = () => {
    if (!effectiveExitSessionId) return;
    runAction(
      () => sessionService.simulateExit({ sessaoId: effectiveExitSessionId }),
      (updated) => `Saída concluída com sucesso para a sessão ${updated.id}.`,
    );
  };

  const handleToggleAuto = () => {
    const running = sessionService.autoSimulator.toggle(3200);
    setFeedback({
      type: 'info',
      message: running
        ? 'Simulador automático iniciado (ciclo a cada ~3,2s respeitando conexões).'
        : 'Simulador automático pausado.',
    });
  };

  const handleReset = () =>
    runAction(
      async () => {
        sessionService.resetDemoState();
        return null;
      },
      'Dados de demonstração restaurados para o estado inicial.',
    );

  return (
    <Card className="border border-brand-200 bg-gradient-to-br from-brand-950 via-slate-900 to-brand-900 text-white">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-500/20 text-brand-300 ring-1 ring-brand-400/30">
            <FlaskConical className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-wide text-white">
                Laboratório de Simulação (Modo Demonstração)
              </h2>
              <Badge variant={autoRunning ? 'success' : 'neutral'} dot>
                {autoRunning ? 'Simulador ativo' : 'Manual'}
              </Badge>
            </div>
            <p className="text-xs text-brand-200/80">
              Dispare entradas, falhas de câmera OCR, movimentações conectadas e saídas para
              demonstrar o sistema em tempo real.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={autoRunning ? 'danger' : 'success'}
            icon={autoRunning ? Pause : Play}
            onClick={handleToggleAuto}
          >
            {autoRunning ? 'Pausar simulador' : 'Iniciar simulador'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            onClick={handleReset}
            disabled={busy}
          >
            Restaurar dados
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 1. Entrada e falha de leitura de placa */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
            1. Entrada de veículo / OCR
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Input
              label="Placa (Mercosul)"
              value={placaInput}
              onChange={(e) => setPlacaInput(e.target.value.toUpperCase())}
              maxLength={8}
              className="bg-white/95 text-xs"
              containerClassName="[&_label]:text-brand-100"
            />
            <Select
              label="Setor de entrada"
              value={entrySectorId}
              onChange={(e) => setEntrySectorId(e.target.value)}
              options={[
                { value: 'A', label: 'Setor A (Entrada)' },
                { value: 'B', label: 'Setor B (Entrada)' },
              ]}
              className="bg-white/95 text-xs"
              containerClassName="[&_label]:text-brand-100"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="primary"
              icon={LogIn}
              onClick={handleEntryWithPlate}
              loading={busy}
              className="flex-1"
            >
              Simular entrada
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={ShieldAlert}
              onClick={handleEntryUnidentified}
              disabled={busy}
              title="Simula veículo cuja placa não pôde ser lida na cancela"
            >
              Sem placa (falha OCR)
            </Button>
          </div>
        </div>

        {/* 2. Movimentação entre setores conectados */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
            2. Movimentar entre setores conectados
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <Select
              label="Sessão no pátio"
              value={effectiveSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              options={
                activeTickets.length
                  ? activeTickets.map((s) => ({
                      value: s.id,
                      label: `${s.id} · ${formatPlate(s.placa)} (Setor ${s.ultimoSetorId})`,
                    }))
                  : [{ value: '', label: 'Nenhuma sessão' }]
              }
              className="bg-white/95 text-xs"
              containerClassName="[&_label]:text-brand-100"
            />
            <Select
              label="Setor vizinho conectado"
              value={effectiveTargetSector}
              onChange={(e) => setTargetSectorId(e.target.value)}
              options={
                neighbors.length
                  ? neighbors.map((secId) => ({
                      value: secId,
                      label: `Setor ${secId}`,
                    }))
                  : [{ value: '', label: 'Sem vizinhos' }]
              }
              className="bg-white/95 text-xs"
              containerClassName="[&_label]:text-brand-100"
            />
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              variant="primary"
              icon={ArrowRight}
              onClick={handleMove}
              disabled={busy || !effectiveSessionId || !effectiveTargetSector}
              className="w-full"
            >
              Mover para Setor {effectiveTargetSector || '—'}
            </Button>
          </div>
        </div>

        {/* 3. Saída validando autorização e conexão */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
            3. Cancela de saída (valida autorização)
          </p>
          <div className="mt-2.5">
            <Select
              label="Sessão para tentativa de saída"
              value={effectiveExitSessionId}
              onChange={(e) => setExitSessionId(e.target.value)}
              options={
                activeTickets.length
                  ? activeTickets.map((s) => ({
                      value: s.id,
                      label: `${s.id} · ${formatPlate(s.placa)} (${s.status} · Setor ${s.ultimoSetorId})`,
                    }))
                  : [{ value: '', label: 'Nenhuma sessão' }]
              }
              className="bg-white/95 text-xs"
              containerClassName="[&_label]:text-brand-100"
            />
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              variant="primary"
              icon={LogOut}
              onClick={handleExit}
              disabled={busy || !effectiveExitSessionId}
              className="w-full"
            >
              Simular saída na cancela
            </Button>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3.5 py-2 text-xs font-medium ${
            feedback.type === 'error'
              ? 'bg-status-full/25 text-red-100 ring-1 ring-red-400/40'
              : 'bg-white/10 text-brand-100 ring-1 ring-white/20'
          }`}
        >
          <span>{feedback.message}</span>
          {feedback.ticketToken && (
            <a
              href={buildTicketPath(feedback.ticketToken)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-brand-900 hover:bg-brand-50"
            >
              Abrir ticket do motorista
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
