import { ShieldAlert } from 'lucide-react';
import { authService } from '@/services/auth.service';
import { isLocalDemoMode } from '@/config/app.config';
import Card from '@/components/ui/Card';

export default function ProtectedRoute({ children }) {
  const allowed = authService.isAuthenticated() || isLocalDemoMode();

  if (allowed) return children;

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="max-w-md text-center">
        <ShieldAlert className="mx-auto size-10 text-status-full" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-slate-600">
          O painel administrativo exige autenticação. O acesso sem login só está disponível no modo
          de demonstração local.
        </p>
      </Card>
    </main>
  );
}
