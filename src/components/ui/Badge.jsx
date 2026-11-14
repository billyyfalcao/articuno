import { cn } from '@/utils/cn';

const VARIANTS = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  success: 'bg-status-available-soft text-emerald-900 ring-emerald-300',
  warning: 'bg-status-moderate-soft text-amber-900 ring-amber-300',
  danger: 'bg-status-full-soft text-red-900 ring-red-300',
};

/** Selo compacto para status, faixas de disponibilidade e contadores. */
export default function Badge({ variant = 'neutral', dot = false, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        VARIANTS[variant] || VARIANTS.neutral,
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
