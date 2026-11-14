import { cn } from '@/utils/cn';

const SIZES = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-9 border-3',
};

/** Indicador visual de carregamento acessível. */
export default function Spinner({ size = 'md', label = 'Carregando...', className }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <span
        className={cn(
          'inline-block animate-spin rounded-full border-current border-r-transparent text-brand-600',
          SIZES[size] || SIZES.md,
          className,
        )}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
