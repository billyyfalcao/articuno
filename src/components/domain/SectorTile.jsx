import { Sparkles, Navigation } from 'lucide-react';
import { computeSectorAvailability } from '@/domain/availability';
import { AVAILABILITY_LEVEL } from '@/domain/constants';
import OccupancyBar from './OccupancyBar';
import { cn } from '@/utils/cn';

const LEVEL_STYLES = {
  [AVAILABILITY_LEVEL.GREEN]: {
    border: 'border-emerald-300',
    badgeBg: 'bg-status-available-soft text-emerald-900',
    dot: 'bg-status-available',
  },
  [AVAILABILITY_LEVEL.YELLOW]: {
    border: 'border-amber-300',
    badgeBg: 'bg-status-moderate-soft text-amber-900',
    dot: 'bg-status-moderate',
  },
  [AVAILABILITY_LEVEL.RED]: {
    border: 'border-red-300',
    badgeBg: 'bg-status-full-soft text-red-900',
    dot: 'bg-status-full',
  },
};

/**
 * Bloco individual de um setor (A–G) dentro do componente ParkingMap.
 */
export default function SectorTile({
  sector,
  highlighted = false,
  recommendedRank = null,
  selected = false,
  onSelect,
  style,
}) {
  const availability = computeSectorAvailability(sector);
  const tone = LEVEL_STYLES[availability.level] || LEVEL_STYLES[AVAILABILITY_LEVEL.GREEN];
  const interactive = typeof onSelect === 'function';
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => onSelect(sector) : undefined}
      style={style}
      className={cn(
        'group relative flex flex-col justify-between rounded-2xl border-2 bg-surface p-3.5 text-left transition-all',
        tone.border,
        interactive && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md',
        selected && 'ring-2 ring-brand-600 ring-offset-2',
        highlighted && 'ring-3 ring-brand-600 bg-brand-50/60 shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">
            {sector.id}
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">{sector.nome}</p>
            <p className="flex items-center gap-1 text-[11px] text-slate-500">
              <Navigation className="size-3" aria-hidden="true" />
              {sector.distanciaEntrada}m da entrada
            </p>
          </div>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
            tone.badgeBg,
          )}
        >
          <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden="true" />
          {availability.freePercent}% livre
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        <OccupancyBar sector={sector} />
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>
            ≈ {availability.ocupacaoEstimada}/{availability.capacidade} ocupadas
          </span>
          <span className="font-semibold text-slate-800">
            {availability.vagasLivresEstimadas} livres (est.)
          </span>
        </div>
      </div>

      {(highlighted || recommendedRank) && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {highlighted && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2 py-0.5 text-[11px] font-semibold text-white">
              Último setor detectado
            </span>
          )}
          {recommendedRank && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-900">
              <Sparkles className="size-3" aria-hidden="true" />#{recommendedRank} Recomendado
            </span>
          )}
        </div>
      )}
    </Tag>
  );
}
