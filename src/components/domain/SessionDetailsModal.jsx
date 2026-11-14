import { ExternalLink, MapPin } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SessionStatusBadge from './SessionStatusBadge';
import ElapsedTime from './ElapsedTime';
import PriceSummary from './PriceSummary';
import ExitDeadline from './ExitDeadline';
import EventList from './EventList';
import { buildTicketPath } from '@/routes/paths';
import { formatDateTime, formatPlate } from '@/utils/formatters';

/**
 * Modal de detalhes completos de uma sessão no Painel Administrativo,
 * exibindo último setor detectado, status de pagamento, janela de saída e
 * histórico completo de movimentações para auditoria.
 */
export default function SessionDetailsModal({ session, open, onClose }) {
  if (!session) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Sessão ${session.id} — ${formatPlate(session.placa)}`}
      description="Detalhes operacionais, pagamento simulado e trilha de auditoria da sessão."
      className="max-w-2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {session.ticketToken ? (
            <a
              href={buildTicketPath(session.ticketToken)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
            >
              Abrir interface do motorista (/ticket/:token)
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : (
            <span />
          )}
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 text-xs sm:grid-cols-4">
          <div>
            <p className="text-slate-500">Status da sessão</p>
            <div className="mt-1">
              <SessionStatusBadge session={session} />
            </div>
          </div>
          <div>
            <p className="text-slate-500">Entrada registrada</p>
            <p className="mt-1 font-semibold text-slate-900">
              {formatDateTime(session.entradaEm)}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Permanência</p>
            <p className="mt-1 font-semibold text-slate-900">
              <ElapsedTime entradaEm={session.entradaEm} />
            </p>
          </div>
          <div>
            <p className="text-slate-500">Último setor detectado</p>
            <p className="mt-1 inline-flex items-center gap-1 font-bold text-brand-800">
              <MapPin className="size-3.5" aria-hidden="true" />
              Setor {session.ultimoSetorId} ({formatDateTime(session.ultimaDeteccaoEm)})
            </p>
          </div>
        </div>

        <ExitDeadline session={session} payment={session.pagamento} />

        <PriceSummary
          entradaEm={session.entradaEm}
          paidPayment={session.pagamento}
          className="p-4 shadow-none ring-1 ring-slate-200"
        />

        <div>
          <h3 className="mb-2 text-xs font-bold tracking-wide text-slate-600 uppercase">
            Histórico de movimentações desta sessão
          </h3>
          <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 px-3.5 py-1">
            <EventList events={session.eventos || []} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
