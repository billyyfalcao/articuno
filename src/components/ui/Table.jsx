import { cn } from '@/utils/cn';
import StateMessage from './StateMessage';

/**
 * Tabela responsiva reutilizável para listagens administrativas.
 *
 * columns: [{ key, header, align?: 'left'|'right'|'center', render?: (row) => ReactNode }]
 */
export default function Table({
  columns = [],
  data = [],
  rowKey = 'id',
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription = 'Não há dados para os filtros selecionados.',
  className,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return <StateMessage variant="empty" title={emptyTitle} description={emptyDescription} />;
  }

  const getKey = (row, idx) => (typeof rowKey === 'function' ? rowKey(row) : row?.[rowKey] ?? idx);

  return (
    <div
      className={cn(
        'overflow-x-auto rounded-card bg-surface shadow-card ring-1 ring-slate-900/5',
        className,
      )}
    >
      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
        <thead className="bg-slate-50/80 text-xs font-semibold tracking-wide text-slate-600 uppercase">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  'px-4 py-3 whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-surface text-slate-700">
          {data.map((row, idx) => (
            <tr key={getKey(row, idx)} className="hover:bg-slate-50/70 transition-colors">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    'px-4 py-3 whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.className,
                  )}
                >
                  {col.render ? col.render(row) : (row?.[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
