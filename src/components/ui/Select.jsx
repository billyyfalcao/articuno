import { useId } from 'react';
import { cn } from '@/utils/cn';

/** Seletor nativo estilizado, acessível e sem dependências extras. */
export default function Select({
  label,
  hint,
  error,
  options = [],
  className,
  containerClassName,
  id,
  children,
  ...props
}) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-xl border bg-surface px-3.5 py-2 text-sm text-slate-900 transition-colors',
          error
            ? 'border-status-full focus:border-status-full'
            : 'border-slate-300 focus:border-brand-600',
          className,
        )}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {children ||
          options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
      </select>
      {error ? (
        <p className="text-xs font-medium text-status-full">{error}</p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  );
}
