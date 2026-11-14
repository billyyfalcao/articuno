import { NavLink, Outlet } from 'react-router';
import { Car, History, LayoutDashboard, LayoutGrid } from 'lucide-react';
import { ROUTES } from '@/routes/paths';
import Logo from '@/components/ui/Logo';
import DemoBanner from '@/components/domain/DemoBanner';
import { cn } from '@/utils/cn';

const NAV_ITEMS = [
  { to: ROUTES.ADMIN.DASHBOARD, label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: ROUTES.ADMIN.VEHICLES, label: 'Veículos', icon: Car },
  { to: ROUTES.ADMIN.SECTORS, label: 'Setores', icon: LayoutGrid },
  { to: ROUTES.ADMIN.HISTORY, label: 'Histórico', icon: History },
];

export default function AdminLayout() {
  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-brand-950 px-4 py-6 lg:flex">
        <Logo inverted className="px-2" />
        <nav aria-label="Navegação administrativa" className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-brand-100/80 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-brand-100/60">Painel Administrativo</p>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
      </header>

      <DemoBanner variant="admin" />

      <main className="mx-auto max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Navegação administrativa"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-slate-200 bg-surface lg:hidden"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium',
                isActive ? 'text-brand-700' : 'text-slate-500',
              )
            }
          >
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
