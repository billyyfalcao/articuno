import { FlaskConical } from 'lucide-react';
import { isLocalDemoMode } from '@/config/app.config';

const MESSAGES = {
  admin:
    'Modo demonstração local: dados simulados neste navegador e painel sem autenticação. Não utilize em produção.',
  driver: 'Modo demonstração: dados simulados. Nenhum pagamento real é realizado.',
};

export default function DemoBanner({ variant = 'admin' }) {
  if (!isLocalDemoMode()) return null;

  return (
    <div
      role="note"
      className="flex items-center gap-2 bg-status-moderate-soft px-4 py-2 text-xs font-medium text-amber-900"
    >
      <FlaskConical className="size-4 shrink-0" aria-hidden="true" />
      <span>{MESSAGES[variant]}</span>
    </div>
  );
}
