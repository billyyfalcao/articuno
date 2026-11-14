import { useId } from 'react';
import { cn } from '@/utils/cn';

/** Campo de entrada padrão com rótulo, texto auxiliar e mensagem de erro. */
export default function Input({
  label,
  hint,
  error,
  icon: Icon,
  className,
  containerClassName,
  id,
  ...props
}) {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
        )}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-xl border bg-surface px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors',
            Icon && 'pl-9',
            error
              ? 'border-status-full focus:border-status-full'
              : 'border-slate-300 focus:border-brand-600',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs font-medium text-status-full">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
