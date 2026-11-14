import { SquareParking } from 'lucide-react';
import { APP_CONFIG } from '@/config/app.config';
import { cn } from '@/utils/cn';

export default function Logo({ inverted = false, className }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'grid size-9 place-items-center rounded-xl',
          inverted ? 'bg-white/15 text-white' : 'bg-brand-700 text-white',
        )}
      >
        <SquareParking className="size-5" aria-hidden="true" />
      </span>
      <span className="leading-tight">
        <span className={cn('block text-sm font-bold', inverted ? 'text-white' : 'text-slate-900')}>
          {APP_CONFIG.brand.team}
        </span>
        <span className={cn('block text-xs', inverted ? 'text-brand-100' : 'text-slate-500')}>
          {APP_CONFIG.brand.product}
        </span>
      </span>
    </div>
  );
}
