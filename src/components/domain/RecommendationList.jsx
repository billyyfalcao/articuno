import { Sparkles, Navigation } from 'lucide-react';
import AvailabilityBadge from './AvailabilityBadge';
import EstimateLabel from './EstimateLabel';

/**
 * Lista de setores recomendados com base na regra 70% disponibilidade + 30% proximidade.
 */
export default function RecommendationList({ recommendations = [], onSelectSector }) {
  if (!recommendations.length) {
    return (
      <p className="text-sm text-slate-500">
        Nenhum setor com vagas livres estimadas no momento.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {recommendations.map((rec, index) => (
        <div
          key={rec.setorId}
          onClick={onSelectSector ? () => onSelectSector(rec.setorId) : undefined}
          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-surface p-3 transition-colors hover:border-brand-300"
        >
          <div className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-800">
              #{index + 1}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{rec.nome}</span>
                <AvailabilityBadge level={rec.level} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <EstimateLabel sector={rec} compact />
                <span>·</span>
                <span className="inline-flex items-center gap-1">
                  <Navigation className="size-3" aria-hidden="true" />
                  {rec.distanciaEntrada}m
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-800">
              <Sparkles className="size-3.5" aria-hidden="true" />
              Índice {rec.scorePercent}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
