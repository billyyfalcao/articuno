import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useNow } from '@/hooks/useNow';
import { evaluateExitAuthorization } from '@/domain/pricing';
import { formatCountdownMs, formatCurrencyFromCents, formatTime } from '@/utils/formatters';

/**
 * Exibe a janela de 15 minutos para saída após o pagamento simulado.
 *
 * Caso o prazo expire:
 *  - mantém o registro do pagamento realizado;
 *  - invalida a autorização de saída;
 *  - informa que será necessária uma regularização (cobrança adicional pelo backend).
 */
export default function ExitDeadline({ session, payment }) {
  const now = useNow(1000, true);
  const auth = evaluateExitAuthorization(session, now);

  if (!auth.hasExitWindow) return null;

  if (auth.requiresRegularization) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-red-300 bg-status-full-soft p-4 text-red-950"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-status-full" aria-hidden="true" />
          <div className="space-y-1 text-xs">
            <p className="text-sm font-bold">
              Prazo de saída expirado — regularização necessária
            </p>
            <p>
              O prazo de 15 minutos para deixar o estacionamento (até{' '}
              <strong>{formatTime(auth.deadlineIso)}</strong>) expirou. A autorização de saída está
              inválida.
            </p>
            {payment && (
              <p className="font-medium">
                Pagamento anterior preservado:{' '}
                <strong>{formatCurrencyFromCents(payment.valorCentavos)}</strong> às{' '}
                {formatTime(payment.pagoEm)}.
              </p>
            )}
            <p className="text-red-900/90">
              Dirija-se ao atendimento ou aguarde o cálculo de regularização pelo sistema central
              (backend).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-300 bg-status-available-soft p-4 text-emerald-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="size-5 shrink-0 text-status-available" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold">Saída autorizada</p>
            <p className="text-xs text-emerald-900">
              Deixe o estacionamento até <strong>{formatTime(auth.deadlineIso)}</strong> (janela de
              15 min após o pagamento).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-white/80 px-3 py-1.5 font-mono text-sm font-bold text-emerald-950">
          <Clock className="size-4" aria-hidden="true" />
          {formatCountdownMs(auth.remainingMs)}
        </div>
      </div>
    </div>
  );
}
