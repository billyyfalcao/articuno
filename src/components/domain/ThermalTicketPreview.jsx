import { useMemo } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Printer,
  QrCode as QrCodeIcon,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { TOTEM_STATE, TOTEM_STATE_META } from '@/domain/constants';
import { buildTicketAbsoluteUrl, buildTicketPath } from '@/routes/paths';
import { formatDateTime, formatPlate } from '@/utils/formatters';
import { formatPublicTicketCode } from '@/utils/plate';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { cn } from '@/utils/cn';

/**
 * Renderiza o QR Code em SVG vetorial de alto contraste a partir da biblioteca `qrcode`.
 * Ideal para impressoras térmicas de 80 mm e leitura rápida pela câmera do smartphone.
 */
function TicketQrCodeSvg({ value, size = 176 }) {
  const matrix = useMemo(() => {
    if (!value) return null;
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      const count = qr.modules.size;
      const data = qr.modules.data;
      const cells = [];
      for (let row = 0; row < count; row += 1) {
        for (let col = 0; col < count; col += 1) {
          if (data[row * count + col]) {
            cells.push(`M${col},${row}h1v1h-1z`);
          }
        }
      }
      return { count, pathData: cells.join('') };
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return null;

  const quietZone = 2;
  const viewBoxSize = matrix.count + quietZone * 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`-${quietZone} -${quietZone} ${viewBoxSize} ${viewBoxSize}`}
      role="img"
      aria-label={`QR Code de acesso ao ticket digital: ${value}`}
      data-qr-value={value}
      shapeRendering="crispEdges"
      className="mx-auto block rounded-lg bg-white p-1 ring-1 ring-slate-200 print:ring-0"
    >
      <rect
        x={-quietZone}
        y={-quietZone}
        width={viewBoxSize}
        height={viewBoxSize}
        fill="#ffffff"
      />
      <path d={matrix.pathData} fill="#000000" />
    </svg>
  );
}

/**
 * Componente de pré-visualização e impressão do Ticket Térmico (80 mm).
 *
 * Regras críticas de segurança e arquitetura:
 *  - NÃO gera token próprio: utiliza estritamente `ticket.token` retornado pela sessão criada.
 *  - NÃO expõe o ID interno da sessão (`SES-xxxx`) como credencial no QR Code.
 *  - Permite imprimir / salvar em PDF ou reimprimir o MESMO ticket sem duplicar sessão.
 */
export default function ThermalTicketPreview({
  ticket,
  printState = TOTEM_STATE.TICKET_ISSUED,
  printFeedback = null,
  printing = false,
  onPrint,
}) {
  if (!ticket || !ticket.token) return null;

  const ticketUrl = buildTicketAbsoluteUrl(ticket.token);
  const ticketRelativePath = buildTicketPath(ticket.token);
  const publicTicketCode = formatPublicTicketCode(ticket.token);
  const paperWidthMm = APP_CONFIG.totem?.thermalPaperWidthMm || 80;
  const stateMeta =
    TOTEM_STATE_META[printState] || TOTEM_STATE_META[TOTEM_STATE.TICKET_ISSUED];

  const isPrintFailed = printState === TOTEM_STATE.PRINT_FAILED;
  const isPrintRequested = printState === TOTEM_STATE.PRINT_REQUESTED;
  const isPrintSimulated = printState === TOTEM_STATE.PRINT_SIMULATED;

  return (
    <div className="space-y-4">
      {/* Banner explícito de status da impressão (oculto no papel impresso) */}
      <div
        role="status"
        className={cn(
          'totem-no-print flex flex-col gap-2 rounded-2xl border p-3.5 text-xs',
          isPrintFailed
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : isPrintRequested
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
              : 'border-brand-200 bg-brand-50/70 text-slate-800',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-extrabold">
            {isPrintFailed ? (
              <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <span>Status da Impressão Térmica ({paperWidthMm} mm):</span>
          </div>
          <Badge variant={stateMeta.badgeVariant} dot>
            {stateMeta.label}
          </Badge>
        </div>

        <p className="leading-relaxed">
          {printFeedback || stateMeta.description}
        </p>

        {(isPrintRequested || isPrintSimulated) && (
          <p className="text-[11px] font-medium text-slate-600">
            Nota: No modo demonstração, a abertura da janela de impressão do navegador é apenas
            simulada/assistida e não confirma que o papel físico foi impresso.
          </p>
        )}
      </div>

      {/* Cupom Térmico de 80 mm (visível na tela como pré-visualização e isolado em @media print) */}
      <div
        id="thermal-ticket-print-area"
        className="thermal-ticket-sheet mx-auto w-full max-w-[320px] rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 font-mono text-slate-900 shadow-md"
      >
        {/* Cabeçalho do cupom térmico */}
        <div className="border-b-2 border-dashed border-slate-300 pb-3 text-center">
          <p className="text-[11px] font-bold tracking-widest uppercase">
            {APP_CONFIG.brand.team} · {APP_CONFIG.brand.product}
          </p>
          <h4 className="mt-0.5 font-sans text-base font-black tracking-tight text-slate-950">
            {APP_CONFIG.brand.venue || 'Capim Dourado Shopping'}
          </h4>
          <p className="mt-0.5 font-sans text-[11px] font-semibold text-slate-600">
            COMPROVANTE DE ENTRADA ({paperWidthMm} mm)
          </p>
        </div>

        {/* Dados principais da sessão */}
        <dl className="my-3.5 space-y-2 border-b-2 border-dashed border-slate-300 pb-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="font-sans text-[11px] font-semibold text-slate-500 uppercase">
              Ticket Público:
            </dt>
            <dd className="font-mono text-xs font-black text-slate-950">{publicTicketCode}</dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="font-sans text-[11px] font-semibold text-slate-500 uppercase">
              Entrada:
            </dt>
            <dd className="font-mono text-xs font-bold text-slate-900">
              {formatDateTime(ticket.entradaEm)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="font-sans text-[11px] font-semibold text-slate-500 uppercase">
              Placa:
            </dt>
            <dd
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-xs font-black',
                ticket.placa
                  ? 'bg-slate-900 text-white print:border print:border-black print:bg-transparent print:text-black'
                  : 'bg-amber-100 font-sans text-[11px] text-amber-950',
              )}
            >
              {formatPlate(ticket.placa)}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="font-sans text-[11px] font-semibold text-slate-500 uppercase">
              Setor Recomendado:
            </dt>
            <dd className="font-sans text-sm font-black text-emerald-800 print:text-black">
              {ticket.recommendedSectorName || `Setor ${ticket.ultimoSetorId}`}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-2">
            <dt className="font-sans text-[11px] font-semibold text-slate-500 uppercase">
              Portão / Acesso:
            </dt>
            <dd className="font-sans text-xs font-bold text-slate-700">
              Setor {ticket.ultimoSetorId}
            </dd>
          </div>
        </dl>

        {/* QR Code exclusivo apontando para /ticket/:token */}
        <div className="text-center">
          <p className="mb-2 inline-flex items-center gap-1 font-sans text-[11px] font-extrabold tracking-wide text-slate-800 uppercase">
            <QrCodeIcon className="size-3.5" aria-hidden="true" />
            Acesse seu Ticket Digital
          </p>

          <TicketQrCodeSvg value={ticketUrl} size={172} />

          <p className="mt-2.5 font-sans text-[11px] leading-snug font-medium text-slate-700">
            Escaneie o QR Code com a câmera do celular para consultar tempo de permanência,
            localização aproximada e realizar o pagamento.
          </p>

          <p className="mt-2 break-all rounded bg-slate-100 px-2 py-1 font-mono text-[10px] text-slate-600 print:bg-transparent">
            {ticketRelativePath}
          </p>
        </div>
      </div>

      {/* Ações de Impressão / Reimpressão e Acesso Rápido ao Ticket Digital (ocultas na impressão) */}
      <div className="totem-no-print space-y-2.5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            variant={isPrintFailed ? 'warning' : 'primary'}
            size="lg"
            icon={isPrintFailed ? RefreshCw : Printer}
            loading={printing}
            onClick={() => onPrint?.({ openBrowserPrintDialog: true })}
            className="w-full justify-center py-3 text-xs font-extrabold"
          >
            {isPrintFailed
              ? 'Reimprimir mesmo ticket'
              : isPrintRequested
                ? 'Reimprimir / Salvar PDF'
                : 'Imprimir / Salvar PDF'}
          </Button>

          <a
            href={ticketRelativePath}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-xs font-extrabold text-brand-900 transition-colors hover:bg-brand-100"
          >
            <Smartphone className="size-4 text-brand-700" aria-hidden="true" />
            <span>Abrir Ticket do Motorista</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        </div>

        <p className="text-center text-[11px] text-slate-500">
          Para abrir o QR Code em outro celular físico durante a demonstração, utilize uma URL
          pública acessível (ex.: túnel/rede local) conectada ao backend compartilhado.
        </p>
      </div>
    </div>
  );
}
