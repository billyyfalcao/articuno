import { useState } from 'react';
import { Eye, ExternalLink, MapPin, RefreshCw, Search } from 'lucide-react';
import { useSessions } from '@/hooks/useSessions';
import { SESSION_STATUS, PAYMENT_STATUS_LABELS } from '@/domain/constants';
import { SECTORS_CONFIG } from '@/mocks/sectors.config';
import { buildTicketPath } from '@/routes/paths';
import {
  formatCurrencyFromCents,
  formatDateTime,
  formatPlate,
  formatTime,
} from '@/utils/formatters';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import StateMessage from '@/components/ui/StateMessage';
import SessionStatusBadge from '@/components/domain/SessionStatusBadge';
import ElapsedTime from '@/components/domain/ElapsedTime';
import SessionDetailsModal from '@/components/domain/SessionDetailsModal';

const STATUS_FILTER_OPTIONS = [
  { value: 'TODOS', label: 'Todos os status' },
  { value: SESSION_STATUS.ACTIVE, label: 'Ativas (no pátio)' },
  { value: SESSION_STATUS.PAID, label: 'Pagas (aguardando saída)' },
  { value: SESSION_STATUS.FINISHED, label: 'Finalizadas' },
];

const SECTOR_FILTER_OPTIONS = [
  { value: 'TODOS', label: 'Todos os setores (A–G)' },
  ...SECTORS_CONFIG.map((s) => ({ value: s.id, label: s.nome })),
];

export default function VehiclesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [sectorFilter, setSectorFilter] = useState('TODOS');
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  const { sessions, loading, refreshing, error, lastUpdatedAt } = useSessions({
    status: statusFilter,
    search,
    setorId: sectorFilter,
  });

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) || null;

  const columns = [
    {
      key: 'placa',
      header: 'Placa do veículo',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex rounded-lg px-2.5 py-1 font-mono text-xs font-bold tracking-wider ring-1 ${
              row.placa
                ? 'bg-slate-900 text-white ring-slate-800'
                : 'bg-amber-50 text-amber-900 ring-amber-300 font-sans tracking-normal'
            }`}
          >
            {formatPlate(row.placa)}
          </span>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Sessão',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-700">{row.id}</span>
      ),
    },
    {
      key: 'entradaEm',
      header: 'Horário de entrada',
      render: (row) => <span className="text-xs">{formatDateTime(row.entradaEm)}</span>,
    },
    {
      key: 'permanencia',
      header: 'Permanência',
      render: (row) => (
        <ElapsedTime
          entradaEm={row.entradaEm}
          endTime={row.status === SESSION_STATUS.FINISHED ? row.ultimaDeteccaoEm : null}
          className="font-medium text-slate-800"
        />
      ),
    },
    {
      key: 'ultimoSetorId',
      header: 'Último setor',
      render: (row) => (
        <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-800">
          <MapPin className="size-3.5" aria-hidden="true" />
          Setor {row.ultimoSetorId}
        </span>
      ),
    },
    {
      key: 'ultimaDeteccaoEm',
      header: 'Última detecção',
      render: (row) => <span className="text-xs">{formatDateTime(row.ultimaDeteccaoEm)}</span>,
    },
    {
      key: 'status',
      header: 'Status da sessão',
      render: (row) => <SessionStatusBadge session={row} />,
    },
    {
      key: 'pagamento',
      header: 'Status do pagamento',
      render: (row) => {
        if (row.pagamento) {
          return (
            <div className="space-y-0.5">
              <Badge variant="success">
                {PAYMENT_STATUS_LABELS[row.pagamento.status] || 'Pago'} ·{' '}
                {formatCurrencyFromCents(row.pagamento.valorCentavos)}
              </Badge>
              <p className="text-[11px] text-slate-500">
                às {formatTime(row.pagamento.pagoEm)}
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-0.5">
            <Badge variant="neutral">Pendente</Badge>
            <p className="text-[11px] text-slate-500">
              Est. {formatCurrencyFromCents(row.valorEstimadoCentavos)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() => setSelectedSessionId(row.id)}
          >
            Detalhes
          </Button>
          {row.ticketToken && row.status !== SESSION_STATUS.FINISHED && (
            <a
              href={buildTicketPath(row.ticketToken)}
              target="_blank"
              rel="noreferrer"
              title="Abrir visão do motorista (/ticket/:token)"
              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
            >
              Ticket
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de veículos"
        description="Acompanhe as sessões de estacionamento, último setor identificado, status de pagamento e histórico individual."
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

      {/* Barra de pesquisa e filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input
            label="Pesquisar por placa ou ID da sessão"
            placeholder="Ex.: BRA2E19, SES-1001 ou Não identificada"
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Filtrar por status da sessão"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={STATUS_FILTER_OPTIONS}
          />
          <Select
            label="Filtrar por último setor"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            options={SECTOR_FILTER_OPTIONS}
          />
        </div>
      </Card>

      {loading && sessions.length === 0 ? (
        <StateMessage variant="loading" title="Carregando sessões de veículos..." />
      ) : error && sessions.length === 0 ? (
        <StateMessage
          variant="error"
          title="Erro ao carregar veículos"
          description={error.message}
        />
      ) : (
        <Table
          columns={columns}
          data={sessions}
          emptyTitle="Nenhuma sessão encontrada"
          emptyDescription="Ajuste os filtros de status, setor ou termo pesquisado."
        />
      )}

      <SessionDetailsModal
        session={selectedSession}
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSessionId(null)}
      />
    </div>
  );
}
