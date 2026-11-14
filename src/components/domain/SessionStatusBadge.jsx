import Badge from '@/components/ui/Badge';
import { SESSION_STATUS, SESSION_STATUS_LABELS } from '@/domain/constants';
import { evaluateExitAuthorization } from '@/domain/pricing';

/**
 * Selo de status da sessão, contemplando o caso de prazo de saída expirado
 * (mantém o status PAGA, mas indica que a autorização de saída expirou).
 */
export default function SessionStatusBadge({ session, status, now }) {
  const effectiveStatus = session?.status || status || SESSION_STATUS.ACTIVE;
  const exitAuth = session ? evaluateExitAuthorization(session, now) : null;

  if (effectiveStatus === SESSION_STATUS.PAID && exitAuth?.requiresRegularization) {
    return (
      <Badge variant="danger" dot>
        Paga · Prazo expirado (regularizar)
      </Badge>
    );
  }

  const variantMap = {
    [SESSION_STATUS.ACTIVE]: 'brand',
    [SESSION_STATUS.PAID]: 'success',
    [SESSION_STATUS.FINISHED]: 'neutral',
  };

  return (
    <Badge variant={variantMap[effectiveStatus] || 'neutral'} dot>
      {SESSION_STATUS_LABELS[effectiveStatus] || effectiveStatus}
    </Badge>
  );
}
