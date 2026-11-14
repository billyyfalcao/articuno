import { useNow } from '@/hooks/useNow';
import { calculateEstimatedTariff } from '@/domain/pricing';
import { formatCurrencyFromCents, formatDurationFromMs } from '@/utils/formatters';
import Card from '@/components/ui/Card';

/**
 * Resumo demonstrativo da tarifa (R$ 6,00 1ª hora + R$ 3,00 por hora adicional iniciada).
 */
export default function PriceSummary({ entradaEm, paidPayment = null, className }) {
  const now = useNow(1000, !paidPayment);
  const breakdown = calculateEstimatedTariff(
    entradaEm,
    paidPayment?.pagoEm ? new Date(paidPayment.pagoEm).getTime() : now,
  );
  const finalCents = paidPayment?.valorCentavos ?? breakdown.totalCents;

  return (
    <Card className={className}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {paidPayment ? 'Valor pago (simulado)' : 'Valor estimado até o momento'}
        </span>
        <span className="text-2xl font-bold text-slate-900">
          {formatCurrencyFromCents(finalCents)}
        </span>
      </div>

      <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <div className="flex justify-between">
          <dt>Permanência considerada</dt>
          <dd className="font-medium text-slate-800">
            {formatDurationFromMs(breakdown.elapsedMs)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Primeira hora (fixa)</dt>
          <dd className="font-medium text-slate-800">
            {formatCurrencyFromCents(breakdown.firstHourCents)}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>
            Horas adicionais iniciadas ({breakdown.additionalHours} ×{' '}
            {formatCurrencyFromCents(breakdown.additionalHourCents)})
          </dt>
          <dd className="font-medium text-slate-800">
            {formatCurrencyFromCents(breakdown.additionalCents)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-[11px] text-slate-500">
        Cálculo demonstrativo: R$ 6,00 pela 1ª hora + R$ 3,00 por hora adicional iniciada. O valor
        oficial é responsabilidade do backend.
      </p>
    </Card>
  );
}
