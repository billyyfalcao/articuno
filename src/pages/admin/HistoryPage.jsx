import { useState } from 'react';
import { ArrowRight, History, Receipt, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useHistory } from '@/hooks/useHistory';
import {
  EVENT_TYPE,
  EVENT_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
} from '@/domain/constants';
import { SECTORS_CONFIG } from '@/mocks/sectors.config';
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatPlate,
  formatTime,
} from '@/utils/formatters';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import StateMessage from '@/components/ui/StateMessage';

const CATEGORY_TABS = [
  { id: 'MOVIMENTACOES', label: 'Movimentações e Fluxo', icon: History },
  { id: 'PAGAMENTOS', label: 'Pagamentos Simulados', icon: Receipt },
  { id: 'AJUSTES', label: 'Ajustes Administrativos', icon: SlidersHorizontal },
];

const EVENT_TYPE_OPTIONS = [
  { value: 'TODOS', label: 'Todos os tipos de evento' },
  { value: EVENT_TYPE.ENTRY, label: 'Entradas' },
  { value: EVENT_TYPE.MOVEMENT, label: 'Movimentações entre setores' },
  { value: EVENT_TYPE.PAYMENT, label: 'Pagamentos simulados' },
  { value: EVENT_TYPE.EXIT, label: 'Saídas' },
];

const SECTOR_OPTIONS = [
  { value: 'TODOS', label: 'Todos os setores (A–G)' },
  ...SECTORS_CONFIG.map((s) => ({ value: s.id, label: s.nome })),
];

const EVENT_BADGE_VARIANT = {
  [EVENT_TYPE.ENTRY]: 'brand',
  [EVENT_TYPE.MOVEMENT]: 'neutral',
  [EVENT_TYPE.PAYMENT]: 'success',
  [EVENT_TYPE.EXIT]: 'warning',
};

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState('MOVIMENTACOES');
  const [setorFilter, setSetorFilter] = useState('TODOS');
  const [eventTypeFilter, setEventTypeFilter] = useState('TODOS');

  const { events, payments, adjustments, loading, refreshing, error, lastUpdatedAt } =
    useHistory({
      setorId: setorFilter,
      eventType: eventTypeFilter,
    });

  const eventColumns = [
    {
      key: 'id',
      header: 'ID Evento',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600">{row.id}</span>
      ),
    },
    {
      key: 'tipo',
      header: 'Tipo de evento',
      render: (row) => (
        <Badge variant={EVENT_BADGE_VARIANT[row.tipo] || 'neutral'} dot>
          {EVENT_TYPE_LABELS[row.tipo] || row.tipo}
        </Badge>
      ),
    },
    {
      key: 'sessaoId',
      header: 'Sessão',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-800">{row.sessaoId}</span>
      ),
    },
    {
      key: 'trajeto',
      header: 'Origem → Destino',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
          <span className="rounded bg-slate-100 px-2 py-0.5">{row.origem}</span>
          <ArrowRight className="size-3.5 text-slate-400" aria-hidden="true" />
          <span className="rounded bg-brand-50 px-2 py-0.5 text-brand-800">{row.destino}</span>
        </span>
      ),
    },
    {
      key: 'ocorridoEm',
      header: 'Data / Horário',
      render: (row) => <span className="text-xs">{formatDateTime(row.ocorridoEm)}</span>,
    },
  ];

  const paymentColumns = [
    {
      key: 'id',
      header: 'ID Pagamento',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600">{row.id}</span>
      ),
    },
    {
      key: 'sessaoId',
      header: 'Sessão / Placa',
      render: (row) => (
        <div>
          <span className="font-mono text-xs font-semibold text-slate-900">{row.sessaoId}</span>
          <span className="ml-2 text-xs text-slate-500">({formatPlate(row.placa)})</span>
        </div>
      ),
    },
    {
      key: 'setorId',
      header: 'Setor',
      render: (row) => <Badge variant="brand">Setor {row.setorId}</Badge>,
    },
    {
      key: 'valorCentavos',
      header: 'Valor simulado',
      render: (row) => (
        <span className="font-bold text-slate-900">
          {formatCurrencyFromCents(row.valorCentavos)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant="success" dot>
          {PAYMENT_STATUS_LABELS[row.status] || row.status}
        </Badge>
      ),
    },
    {
      key: 'pagoEm',
      header: 'Horário do pagamento',
      render: (row) => <span className="text-xs">{formatDateTime(row.pagoEm)}</span>,
    },
  ];

  const adjustmentColumns = [
    {
      key: 'id',
      header: 'ID Ajuste',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-600">{row.id}</span>
      ),
    },
    {
      key: 'setorId',
      header: 'Setor ajustado',
      render: (row) => <Badge variant="brand">Setor {row.setorId}</Badge>,
    },
    {
      key: 'mudanca',
      header: 'Ocupação anterior → Nova ocupação',
      render: (row) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
          <span className="rounded bg-slate-100 px-2 py-0.5">
            ≈ {row.ocupacaoAnterior} vagas
          </span>
          <ArrowRight className="size-3.5 text-slate-400" aria-hidden="true" />
          <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
            ≈ {row.novaOcupacao} vagas
          </span>
        </span>
      ),
    },
    {
      key: 'motivo',
      header: 'Motivo registrado (Auditoria)',
      render: (row) => <span className="text-xs text-slate-700">{row.motivo}</span>,
    },
    {
      key: 'ajustadoEm',
      header: 'Horário',
      render: (row) => <span className="text-xs">{formatDateTime(row.ajustadoEm)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico e Auditoria"
        description="Registro imutável de entradas, movimentações entre setores, pagamentos simulados, saídas e ajustes administrativos."
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>
              Atualizado às <strong>{formatTime(lastUpdatedAt)}</strong>
            </span>
            {refreshing && (
              <RefreshCw
                className="size-3.5 animate-spin text-brand-600"
                aria-label="Sincronizando"
              />
            )}
          </div>
        }
      />

      {/* Abas de categoria + Filtros por tipo e setor */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            role="tablist"
            aria-label="Categorias do histórico"
            className="flex flex-wrap gap-2"
          >
            {CATEGORY_TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              const count =
                id === 'MOVIMENTACOES'
                  ? events.length
                  : id === 'PAGAMENTOS'
                    ? payments.length
                    : adjustments.length;

              return (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setActiveTab(id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? 'bg-brand-700 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      active ? 'bg-white/20 text-white' : 'bg-white text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-96">
            {activeTab === 'MOVIMENTACOES' && (
              <Select
                label="Filtrar por tipo de evento"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                options={EVENT_TYPE_OPTIONS}
              />
            )}
            <Select
              label="Filtrar por setor"
              value={setorFilter}
              onChange={(e) => setSetorFilter(e.target.value)}
              options={SECTOR_OPTIONS}
              containerClassName={activeTab !== 'MOVIMENTACOES' ? 'sm:col-span-2' : ''}
            />
          </div>
        </div>
      </Card>

      {loading && events.length === 0 && adjustments.length === 0 ? (
        <StateMessage variant="loading" title="Carregando registros de auditoria..." />
      ) : error ? (
        <StateMessage
          variant="error"
          title="Erro ao consultar histórico"
          description={error.message}
        />
      ) : activeTab === 'MOVIMENTACOES' ? (
        <Table
          columns={eventColumns}
          data={events}
          emptyTitle="Nenhum evento encontrado"
          emptyDescription="Não há entradas, movimentações, pagamentos ou saídas para o filtro selecionado."
        />
      ) : activeTab === 'PAGAMENTOS' ? (
        <Table
          columns={paymentColumns}
          data={payments}
          emptyTitle="Nenhum pagamento simulado encontrado"
          emptyDescription="Os pagamentos simulados pelos motoristas aparecerão aqui."
        />
      ) : (
        <Table
          columns={adjustmentColumns}
          data={adjustments}
          emptyTitle="Nenhum ajuste administrativo registrado"
          emptyDescription="Correções manuais de ocupação realizadas na tela de Setores são listadas aqui."
        />
      )}
    </div>
  );
}
