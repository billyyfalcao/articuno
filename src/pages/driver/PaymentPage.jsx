import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import {
  CheckCircle2,
  FlaskConical,
  Info,
  Receipt,
  Ticket,
} from 'lucide-react';
import { buildTicketPath } from '@/routes/paths';
import { SESSION_STATUS } from '@/domain/constants';
import { APP_CONFIG } from '@/config/app.config';
import { formatDateTime } from '@/utils/formatters';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import SessionStatusBadge from '@/components/domain/SessionStatusBadge';
import PriceSummary from '@/components/domain/PriceSummary';
import ExitDeadline from '@/components/domain/ExitDeadline';

/**
 * Página de pagamento fictício (/ticket/:token/pagamento):
 *  - Exibe o resumo da tarifa (R$ 6,00 1ª hora + R$ 3,00/hora adicional iniciada).
 *  - Apresenta aviso explícito de que o pagamento é fictício (MVP sem cobrança real).
 *  - Botão "Simular pagamento" atualiza o status da sessão para PAGA e inicia
 *    o prazo de 15 minutos para deixar o estacionamento.
 *  - Caso o prazo de 15 minutos expire, preserva o registro do pagamento e informa
 *    a necessidade de regularização.
 */
export default function PaymentPage() {
  const { token } = useParams();
  const { ticket, paying, simulatePayment } = useOutletContext();
  const [actionError, setActionError] = useState(null);
  const [justPaid, setJustPaid] = useState(false);

  const isPaid = ticket.status === SESSION_STATUS.PAID;

  const handleSimulatePayment = async () => {
    setActionError(null);
    try {
      await simulatePayment();
      setJustPaid(true);
    } catch (err) {
      setActionError(err?.message || 'Não foi possível simular o pagamento.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho de status do pagamento */}
      <Card className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">Status atual da sessão</p>
          <p className="mt-0.5 text-sm font-bold text-slate-900">
            {isPaid ? 'Pagamento simulado registrado' : 'Aguardando pagamento'}
          </p>
        </div>
        <SessionStatusBadge session={ticket} />
      </Card>

      {/* Confirmação visual após simular pagamento */}
      {justPaid && isPaid && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-2xl border border-emerald-300 bg-status-available-soft p-3.5 text-xs text-emerald-950"
        >
          <CheckCircle2
            className="mt-0.5 size-5 shrink-0 text-status-available"
            aria-hidden="true"
          />
          <div>
            <p className="font-bold">Pagamento simulado confirmado com sucesso!</p>
            <p className="mt-0.5">
              O status da sua sessão foi atualizado e o prazo de {APP_CONFIG.exitWindowMinutes}{' '}
              minutos para saída já está em andamento.
            </p>
          </div>
        </div>
      )}

      {/* Janela de 15 minutos para saída ou alerta de prazo expirado */}
      <ExitDeadline session={ticket} payment={ticket.pagamento} />

      {/* Detalhamento da tarifa */}
      <PriceSummary
        entradaEm={ticket.entradaEm}
        paidPayment={ticket.pagamento}
      />

      {/* Ação de pagamento fictício ou comprovante de simulação */}
      {!isPaid ? (
        <Card className="space-y-3 border border-brand-200 bg-brand-50/40">
          <div className="flex items-start gap-2.5 text-xs text-slate-700">
            <FlaskConical
              className="mt-0.5 size-4 shrink-0 text-brand-700"
              aria-hidden="true"
            />
            <div>
              <p className="font-bold text-slate-900">
                Simulação de pagamento (MVP — sem transação financeira real)
              </p>
              <p className="mt-0.5 text-slate-600">
                Ao confirmar abaixo, nenhuma cobrança real será efetuada. O sistema registrará o
                pagamento simulado e liberará o prazo de{' '}
                <strong>{APP_CONFIG.exitWindowMinutes} minutos</strong> para a saída do veículo.
              </p>
            </div>
          </div>

          {actionError && (
            <p className="rounded-xl bg-status-full-soft px-3 py-2 text-xs font-semibold text-status-full">
              {actionError}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            icon={Receipt}
            loading={paying}
            onClick={handleSimulatePayment}
            className="w-full justify-center"
          >
            Simular pagamento
          </Button>
        </Card>
      ) : (
        <Card className="space-y-2 bg-slate-50 text-xs text-slate-600">
          <div className="flex items-center justify-between font-semibold text-slate-800">
            <span>Registro do pagamento simulado</span>
            <span>{formatDateTime(ticket.pagamento?.pagoEm)}</span>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
            <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span>
              Este comprovante representa uma simulação para demonstração do sistema e não possui
              valor fiscal ou financeiro.
            </span>
          </p>
        </Card>
      )}

      <Link to={buildTicketPath(token)} className="block">
        <Button variant="secondary" icon={Ticket} className="w-full justify-center py-3">
          Voltar para o resumo do ticket
        </Button>
      </Link>
    </div>
  );
}
