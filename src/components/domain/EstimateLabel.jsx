import { computeSectorAvailability } from '@/domain/availability';
import { cn } from '@/utils/cn';

/**
 * Rótulo padronizado que deixa explícito que a ocupação do setor é sempre uma ESTIMATIVA.
 */
export default function EstimateLabel({ sector, compact = false, className }) {
  const { ocupacaoEstimada, capacidade, vagasLivresEstimadas } =
    computeSectorAvailability(sector);

  if (compact) {
    return (
      <span className={cn('text-xs text-slate-600', className)}>
        ≈ {ocupacaoEstimada}/{capacidade} ocupadas ({vagasLivresEstimadas} livres · est.)
      </span>
    );
  }

  return (
    <span className={cn('text-xs text-slate-600', className)}>
      ≈ <strong className="font-semibold text-slate-800">{ocupacaoEstimada}</strong> de{' '}
      <strong className="font-semibold text-slate-800">{capacidade}</strong> vagas ocupadas ·{' '}
      <span className="font-medium text-slate-700">{vagasLivresEstimadas} livres (estimativa)</span>
    </span>
  );
}
