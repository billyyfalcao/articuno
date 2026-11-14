import { cn } from '@/utils/cn';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-xs',
  secondary:
    'bg-surface text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 active:bg-slate-100',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200/80',
  success: 'bg-status-available text-white hover:brightness-95 shadow-xs',
  danger: 'bg-status-full text-white hover:brightness-95 shadow-xs',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-5 py-3 text-base gap-2.5 rounded-xl',
};

/** Botão reutilizável com variantes visuais e estado de carregamento. */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className,
  children,
  type = 'button',
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
        VARIANTS[variant] || VARIANTS.primary,
        SIZES[size] || SIZES.md,
        className,
      )}
      {...props}
    >
      {loading ? (
        <Spinner size="sm" className="text-current" />
      ) : (
        Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />
      )}
      {children}
    </button>
  );
}
