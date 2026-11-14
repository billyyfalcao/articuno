import { AlertTriangle, Inbox, Info } from 'lucide-react';
import Card from './Card';
import Spinner from './Spinner';
import { cn } from '@/utils/cn';

const ICONS = {
  empty: Inbox,
  error: AlertTriangle,
  info: Info,
};

/**
 * Componente único para estados de carregamento, lista vazia, erro ou aviso.
 */
export default function StateMessage({
  variant = 'empty',
  title,
  description,
  action,
  className,
}) {
  if (variant === 'loading') {
    return (
      <Card className={cn('flex flex-col items-center justify-center py-10 text-center', className)}>
        <Spinner size="lg" label={title || 'Carregando dados...'} />
        <p className="mt-3 text-sm font-medium text-slate-600">
          {title || 'Carregando informações...'}
        </p>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </Card>
    );
  }

  const Icon = ICONS[variant] || Inbox;
  const iconTone =
    variant === 'error'
      ? 'text-status-full bg-status-full-soft'
      : variant === 'info'
        ? 'text-brand-700 bg-brand-50'
        : 'text-slate-500 bg-slate-100';

  return (
    <Card className={cn('flex flex-col items-center justify-center py-8 text-center', className)}>
      <span className={cn('grid size-11 place-items-center rounded-full', iconTone)}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      {title && <h2 className="mt-3 text-base font-semibold text-slate-900">{title}</h2>}
      {description && <p className="mt-1 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}
