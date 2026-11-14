import { NavLink, Outlet, useLocation, useParams } from 'react-router';
import { MapPin, Receipt, RefreshCw, ShieldCheck, Ticket, TicketX } from 'lucide-react';
import { buildTicketPath } from '@/routes/paths';
import { isWellFormedToken } from '@/utils/token';
import { useTicket } from '@/hooks/useTicket';
import { formatTime } from '@/utils/formatters';
import Logo from '@/components/ui/Logo';
import Card from '@/components/ui/Card';
import StateMessage from '@/components/ui/StateMessage';
import DemoBanner from '@/components/domain/DemoBanner';
import { cn } from '@/utils/cn';

/**
 * Mensagem ÚNICA para token malformado, inexistente ou expirado:
 * não revela se uma sessão existe (evita enumeração de tickets).
 */
export function TicketUnavailable() {
  return (
    <Card className="py-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <TicketX className="size-6" aria-hidden="true" />
      </span>
      <h1 className="mt-3 text-lg font-bold text-slate-900">
        Ticket não encontrado ou expirado
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Esta sessão já foi encerrada na saída ou o código do ticket não é válido.
      </p>
      <p className="mt-4 text-xs text-slate-400">
        Por segurança, tickets encerrados deixam de permitir consultas e operações.
      </p>
    </Card>
  );
}

/**
 * Layout da Interface do Motorista (mobile-first).
 * Centraliza o polling (~2,5s) da sessão pública via `useTicket(token)` e
 * compartilha o estado com as 3 abas (`/ticket/:token`, `/localizacao`, `/pagamento`)
 * através do `Outlet context`, evitando requisições duplicadas.
 */
export default function DriverLayout() {
  const { token } = useParams();
  const location = useLocation();
  const isLocationRoute = location.pathname.endsWith('/localizacao');
  const containerWidthClass = isLocationRoute ? 'max-w-xl' : 'max-w-md';
  const validToken = isWellFormedToken(token);
  const ticketState = useTicket(token, { polling: validToken });
  const { ticket, loading, refreshing, error, lastUpdatedAt } = ticketState;

  const tabs = [
    { to: buildTicketPath(token), label: 'Meu Ticket', icon: Ticket, end: true },
    { to: buildTicketPath(token, 'localizacao'), label: 'Localização', icon: MapPin },
    { to: buildTicketPath(token, 'pagamento'), label: 'Pagamento', icon: Receipt },
  ];

  const renderContent = () => {
    if (!validToken) {
      return <TicketUnavailable />;
    }

    if (loading && !ticket) {
      return (
        <StateMessage
          variant="loading"
          title="Consultando seu ticket..."
          description="Sincronizando informações da sua sessão de estacionamento."
        />
      );
    }

    // Se a sessão foi encerrada (status 404), bloqueia imediatamente o ticket
    if (error?.status === 404) {
      return <TicketUnavailable />;
    }

    if (error && !ticket) {
      return (
        <StateMessage
          variant="error"
          title="Não foi possível carregar o ticket"
          description={error.message || 'Tente novamente em alguns instantes.'}
        />
      );
    }

    if (!ticket) {
      return <TicketUnavailable />;
    }

    return (
      <>
        <nav
          aria-label="Seções do ticket"
          className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/80 p-1 shadow-inner"
        >
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all',
                  isActive
                    ? 'bg-surface text-brand-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )
              }
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <Outlet context={ticketState} />
      </>
    );
  };

  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <header className="bg-gradient-to-r from-brand-950 via-brand-900 to-brand-800 px-4 pt-4 pb-5 text-white shadow-sm">
        <div className={cn('mx-auto flex items-center justify-between gap-2', containerWidthClass)}>
          <Logo inverted />
          {validToken && ticket && (
            <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-brand-100">
              <RefreshCw
                className={cn('size-3', refreshing && 'animate-spin text-white')}
                aria-hidden="true"
              />
              <span>{lastUpdatedAt ? formatTime(lastUpdatedAt) : 'Ao vivo'}</span>
            </div>
          )}
        </div>
      </header>

      <DemoBanner variant="driver" />

      <main className={cn('mx-auto w-full flex-1 px-4 py-5', containerWidthClass)}>
        {renderContent()}
      </main>

      <footer
        className={cn(
          'mx-auto w-full px-4 pb-6 text-center text-[11px] text-slate-400',
          containerWidthClass,
        )}
      >
        <p className="inline-flex items-center justify-center gap-1">
          <ShieldCheck className="size-3.5 text-brand-600" aria-hidden="true" />
          Acesso protegido por token aleatório · Equipe Articuno
        </p>
      </footer>
    </div>
  );
}
