import { Link, useRouteError } from 'react-router';
import { CircleAlert } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function NotFoundPage() {
  const error = useRouteError();
  const isUnexpected = error && error.status !== 404;

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <Card className="max-w-md text-center">
        <CircleAlert className="mx-auto size-10 text-slate-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">
          {isUnexpected ? 'Algo deu errado' : 'Página não encontrada'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {isUnexpected
            ? 'Ocorreu um erro inesperado ao carregar esta página.'
            : 'O endereço acessado não existe.'}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:underline"
        >
          Voltar ao início
        </Link>
      </Card>
    </main>
  );
}
