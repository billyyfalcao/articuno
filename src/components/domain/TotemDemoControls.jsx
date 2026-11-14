import { useState } from 'react';
import {
  Camera,
  CameraOff,
  Car,
  CheckCircle2,
  FlaskConical,
  Printer,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { generateSimulatedPlate } from '@/utils/plate';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';

/**
 * Painel de Simulação do Totem Digital de Entrada (exclusivo para Modo Demonstração).
 * Permite acionar todos os eventos de hardware (câmera LPR/OCR, sensor de presença e
 * impressora térmica 80 mm) sem poluir a interface pública de atendimento do motorista.
 */
export default function TotemDemoControls({
  cameraAvailable = true,
  simulatePrintFailure = false,
  autoOpenPrintDialog = false,
  busy = false,
  totemState,
  onSimulateApproach,
  onSimulatePlateRead,
  onSimulateOcrFailure,
  onToggleCameraAvailability,
  onToggleSimulatePrintFailure,
  onToggleAutoOpenPrintDialog,
  onResetTotem,
}) {
  const [plateInput, setPlateInput] = useState(() => generateSimulatedPlate());

  if (!APP_CONFIG.demoMode || !APP_CONFIG.useMocks) return null;

  const handleTriggerPlateRead = () => {
    const targetPlate = plateInput.trim() || generateSimulatedPlate();
    onSimulatePlateRead?.(targetPlate);
  };

  const handleGenerateNewPlate = () => {
    setPlateInput(generateSimulatedPlate());
  };

  return (
    <Card className="totem-no-print border border-brand-200 bg-gradient-to-br from-brand-950 via-slate-900 to-brand-900 text-white">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500/20 text-brand-300 ring-1 ring-brand-400/30">
            <FlaskConical className="size-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold tracking-wide text-white">
                Simulador de Hardware do Totem (Modo Demonstração)
              </h3>
              <Badge variant={cameraAvailable ? 'success' : 'danger'} dot>
                {cameraAvailable ? 'Câmera LPR Online' : 'Câmera Indisponível'}
              </Badge>
              <Badge variant={simulatePrintFailure ? 'warning' : 'info'} dot>
                {simulatePrintFailure ? 'Impressora: Falha Simulada' : 'Impressora 80 mm: Pronta'}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-brand-200/80">
              Simule chegada de veículo, leitura automática de placa, falha de OCR, câmera offline
              e comportamento da impressora térmica.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            icon={RotateCcw}
            onClick={() => {
              setPlateInput(generateSimulatedPlate());
              onResetTotem?.();
            }}
            disabled={busy}
          >
            Reiniciar atendimento
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna 1: Sensor de chegada e leitura bem-sucedida da placa */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
              1. Sensor e Leitura de Placa (OCR)
            </p>
            <button
              type="button"
              onClick={handleGenerateNewPlate}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-300 hover:text-white cursor-pointer"
            >
              <Sparkles className="size-3" aria-hidden="true" />
              Gerar placa
            </button>
          </div>

          <div className="mt-2.5 flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Placa para simulação"
                value={plateInput}
                onChange={(e) => setPlateInput(e.target.value.toUpperCase())}
                placeholder="Ex.: ART4E21"
                maxLength={8}
                className="bg-white/95 font-mono text-xs font-bold tracking-wider"
                containerClassName="[&_label]:text-brand-100"
              />
            </div>
          </div>

          {/* Atalhos rápidos para testar cenários de validação */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-brand-200/70">Preencher rápido:</span>
            <button
              type="button"
              onClick={handleGenerateNewPlate}
              className="rounded bg-white/10 px-2 py-0.5 font-semibold text-brand-100 hover:bg-white/20 cursor-pointer"
            >
              Placa nova
            </button>
            <button
              type="button"
              onClick={() => setPlateInput('BRA2E19')}
              className="rounded bg-white/10 px-2 py-0.5 font-semibold text-amber-200 hover:bg-white/20 cursor-pointer"
              title="Placa que já possui sessão ativa no seed inicial"
            >
              Duplicada (BRA2E19)
            </button>
            <button
              type="button"
              onClick={() => setPlateInput('123-INV')}
              className="rounded bg-white/10 px-2 py-0.5 font-semibold text-red-200 hover:bg-white/20 cursor-pointer"
              title="Placa com formato inválido"
            >
              Inválida (123-INV)
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              variant="secondary"
              icon={Car}
              onClick={onSimulateApproach}
              disabled={busy}
            >
              Simular chegada
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={CheckCircle2}
              onClick={handleTriggerPlateRead}
              loading={busy}
            >
              Simular leitura OK
            </Button>
          </div>
        </div>

        {/* Coluna 2: Falha de leitura OCR e Indisponibilidade da Câmera */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
            2. Contingência da Câmera LPR
          </p>
          <p className="mt-1.5 text-xs text-brand-100/80">
            Teste os fluxos alternativos onde o motorista emite o ticket manualmente sem digitar
            a placa.
          </p>

          <div className="mt-3 space-y-2">
            <Button
              size="sm"
              variant="secondary"
              icon={ShieldAlert}
              onClick={onSimulateOcrFailure}
              disabled={busy || !cameraAvailable}
              className="w-full justify-center"
            >
              Simular falha na leitura OCR
            </Button>

            <Button
              size="sm"
              variant={cameraAvailable ? 'danger' : 'success'}
              icon={cameraAvailable ? CameraOff : Camera}
              onClick={onToggleCameraAvailability}
              disabled={busy}
              className="w-full justify-center"
            >
              {cameraAvailable
                ? 'Simular câmera indisponível'
                : 'Restaurar câmera LPR (Online)'}
            </Button>
          </div>
        </div>

        {/* Coluna 3: Impressora Térmica 80 mm e Comportamento de Impressão */}
        <div className="rounded-xl bg-white/5 p-3.5 ring-1 ring-white/10">
          <p className="text-xs font-semibold tracking-wide text-brand-200 uppercase">
            3. Impressora Térmica (80 mm)
          </p>
          <p className="mt-1.5 text-xs text-brand-100/80">
            Simule falha de papel/porta na impressora térmica ou abertura automática da janela de
            impressão do navegador.
          </p>

          <div className="mt-3 space-y-2">
            <Button
              size="sm"
              variant={simulatePrintFailure ? 'success' : 'secondary'}
              icon={Printer}
              onClick={onToggleSimulatePrintFailure}
              className="w-full justify-center"
            >
              {simulatePrintFailure
                ? 'Restaurar impressora térmica (Normal)'
                : 'Simular falha na impressão'}
            </Button>

            <label className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-brand-100 ring-1 ring-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={autoOpenPrintDialog}
                onChange={(e) => onToggleAutoOpenPrintDialog?.(e.target.checked)}
                className="size-4 rounded border-white/30 accent-brand-500"
              />
              <span>Abrir diálogo de impressão do navegador automaticamente ao emitir</span>
            </label>
          </div>

          <p className="mt-2 text-[11px] text-brand-200/70">
            Estado atual do totem: <strong className="text-white">{totemState}</strong>
          </p>
        </div>
      </div>
    </Card>
  );
}
