import Card from '@/components/ui/Card';
import { cn } from '@/utils/cn';

/** Card de indicador (KPI) do Painel Administrativo. */
export default function StatCard({ label, value, subtitle, icon: Icon, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-status-available-soft text-status-available',
    warning: 'bg-status-moderate-soft text-status-moderate',
    danger: 'bg-status-full-soft text-status-full',
  };

  return (
    <Card className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
      </div>
      {Icon && (
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      )}
    </Card>
  );
}
