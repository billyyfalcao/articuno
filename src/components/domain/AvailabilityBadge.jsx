import Badge from '@/components/ui/Badge';
import { AVAILABILITY_META } from '@/domain/constants';
import { computeSectorAvailability } from '@/domain/availability';

/** Selo visual da disponibilidade do setor (Disponível / Moderado / Quase lotado). */
export default function AvailabilityBadge({ sector, level, showFreePercent = false }) {
  const resolved = sector ? computeSectorAvailability(sector) : null;
  const meta = resolved?.meta || AVAILABILITY_META[level] || AVAILABILITY_META.VERDE;

  return (
    <Badge variant={meta.badgeVariant} dot>
      {meta.label}
      {showFreePercent && resolved ? ` · ${resolved.freePercent}% livre` : ''}
    </Badge>
  );
}
