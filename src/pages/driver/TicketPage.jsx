import { Link, useOutletContext, useParams } from 'react-router';
import {
  CalendarClock,
  Clock,
  MapPin,
  Receipt,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import { buildTicketPath } from '@/routes/paths';
import { useNow } from '@/hooks/useNow';
import { calculateEstimatedTariff } from '@/domain/pricing';
import { SESSION_STATUS } from '@/domain/constants';
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatPlate,
  formatTime,
} from '@/utils/formatters';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SessionStatusBadge from '@/components/domain/SessionStatusBadge';
import ElapsedTime from '@/components/domain/ElapsedTime';
import ExitDeadline from '@/components/domain/ExitDeadline';

/**
 * Página principal do motorista (/ticket/:token):
 * Consulta do ticket, status da sessão, placa (ou "Não identificada"),
 * horário de entrada, tempo de permanência em tempo real, valor estimado
 * e último setor detectado com horário.
 */
export default function TicketPage() {
  const { token } = useParams();
  const { ticket } = useOutletContext();
  const now = useNow(1000, ticket.status === SESSION_STATUS.ACTIVE);

  const liveTariff = calculateEstimatedTariff(
    ticket.entradaEm,
    ticket.pagamento?.pagoEm ? new Date(ticket.pagamento.pagoEm).getTime() : now,
  );
  const displayAmountCents = ticket.pagamento?.valorCentavos ?? liveTariff.totalCents;

  return (
    <div className="space-y-4">
      {/* Cabeçalho do Ticket Digital */}
      <Card className="relative overflow-hidden border-t-4 border-t-brand-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Placa do veículo
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={`inline-flex rounded-xl px-3 py-1 font-mono text-lg font-extrabold tracking-widest ring-1 ${
                  ticket.placa
                    ? 'bg-slate-900 text-white ring-slate-800'
                    : 'bg-amber-50 text-amber-900 ring-amber-300 font-sans text-sm tracking-normal'
                }`}
              >
                {formatPlate(ticket.placa)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              Status
            </span>
            <div className="mt-1">
              <SessionStatusBadge session={ticket} now={now} />
            </div>
          </div>
        </div>

        {!ticket.placa && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50/90 p-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              A placa não pôde ser lida na entrada. Seu acesso e pagamento continuam vinculados com
              segurança a este ticket digital.
            </span>
          </div>
        )}

        {/* Métricas de tempo de permanência e valor estimado */}
        <div className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200/70">
          <div>
            <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <Timer className="size-3.5 text-brand-600" aria-hidden="true" />
              Permanência
            </p>
            <p className="mt-1 text-xl font-extrabold text-slate-900">
              <ElapsedTime entradaEm={ticket.entradaEm} />
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Entrada às {formatTime(ticket.entradaEm)}
            </p>
          </div>

          <div className="border-l border-slate-200 pl-3">
            <p className="flex items-center gap-1 text-xs font-medium text-slate-500">
              <Receipt className="size-3.5 text-brand-600" aria-hidden="true" />
              {ticket.pagamento ? 'Valor pago' : 'Valor estimado'}
            </p>
            <p className="mt-1 text-xl font-extrabold text-brand-800">
              {formatCurrencyFromCents(displayAmountCents)}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              1ªh R$ 6,00 + R$ 3,00/h inic.
            </p>
          </div>
        </div>

        {/* Detalhes de entrada e última detecção de setor */}
        <dl className="mt-4 divide-y divide-slate-100 text-xs">
          <div className="flex items-center justify-between py-2.5">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <CalendarClock className="size-4 text-slate-400" aria-hidden="true" />
              Entrada registrada
            </dt>
            <dd className="font-semibold text-slate-800">{formatDateTime(ticket.entradaEm)}</dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <MapPin className="size-4 text-brand-600" aria-hidden="true" />
              Último setor detectado
            </dt>
            <dd className="font-bold text-brand-800">{ticket.ultimoSetorNome}</dd>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <dt className="flex items-center gap-1.5 text-slate-500">
              <Clock className="size-4 text-slate-400" aria-hidden="true" />
              Horário da identificação
            </dt>
            <dd className="font-semibold text-slate-800">
              {formatDateTime(ticket.ultimaDeteccaoEm)}
            </dd>
          </div>
        </dl>
      </Card>

      {/* Janela de saída de 15 minutos ou alerta de regularização */}
      <ExitDeadline session={ticket} payment={ticket.pagamento} />

      {/* Ações rápidas para as outras abas do motorista */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Link to={buildTicketPath(token, 'localizacao')} className="block">
          <Button variant="secondary" icon={MapPin} className="w-full justify-center py-3">
            Ver último setor no mapa
          </Button>
        </Link>

        <Link to={buildTicketPath(token, 'pagamento')} className="block">
          <Button variant="primary" icon={Receipt} className="w-full justify-center py-3">
            {ticket.status === SESSION_STATUS.PAID
              ? 'Ver comprovante e prazo'
              : 'Ir para pagamento'}
          </Button>
        </Link>
      </div>
    </div>
  );
}
