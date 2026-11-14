import { ArrowRight, LogIn, LogOut, Receipt } from 'lucide-react';
import { EVENT_TYPE, EVENT_TYPE_LABELS } from '@/domain/constants';
import { formatDateTime } from '@/utils/formatters';

const EVENT_ICONS = {
  [EVENT_TYPE.ENTRY]: LogIn,
  [EVENT_TYPE.MOVEMENT]: ArrowRight,
  [EVENT_TYPE.PAYMENT]: Receipt,
  [EVENT_TYPE.EXIT]: LogOut,
};

/** Lista compacta de eventos de auditoria (entradas, movimentações, pagamentos e saídas). */
export default function EventList({ events = [] }) {
  if (!events.length) {
    return <p className="text-sm text-slate-500">Nenhuma movimentação registrada.</p>;
  }

  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {events.map((evt) => {
        const Icon = EVENT_ICONS[evt.tipo] || ArrowRight;
        return (
          <li key={evt.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-700">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-slate-800">
                  {EVENT_TYPE_LABELS[evt.tipo] || evt.tipo}{' '}
                  <span className="font-normal text-slate-500">
                    ({evt.origem} → {evt.destino})
                  </span>
                </p>
                <p className="text-xs text-slate-500">Sessão {evt.sessaoId}</p>
              </div>
            </div>
            <time className="text-xs text-slate-500">{formatDateTime(evt.ocorridoEm)}</time>
          </li>
        );
      })}
    </ul>
  );
}
