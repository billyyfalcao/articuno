import { computeSectorAvailability } from '@/domain/availability';
import { AVAILABILITY_LEVEL } from '@/domain/constants';
import { cn } from '@/utils/cn';

const BAR_COLORS = {
  [AVAILABILITY_LEVEL.GREEN]: 'bg-status-available',
  [AVAILABILITY_LEVEL.YELLOW]: 'bg-status-moderate',
  [AVAILABILITY_LEVEL.RED]: 'bg-status-full',
};

/** Barra de ocupação estimada colorida conforme a regra de vagas livres. */
export default function OccupancyBar({ sector, className }) {
  const { occupancyPercent, level } = computeSectorAvailability(sector);

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
      role="progressbar"
      aria-valuenow={occupancyPercent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Ocupação estimada de ${occupancyPercent}%`}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300', BAR_COLORS[level])}
        style={{ width: `${occupancyPercent}%` }}
      />
    </div>
  );
}
