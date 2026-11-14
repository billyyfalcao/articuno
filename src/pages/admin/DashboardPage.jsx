import { Link } from 'react-router';
import {
  Activity,
  ArrowLeftRight,
  Building2,
  Car,
  CheckCircle2,
  Clock,
  ParkingCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useDashboard } from '@/hooks/useDashboard';
import { ROUTES } from '@/routes/paths';
import { formatTime } from '@/utils/formatters';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import StateMessage from '@/components/ui/StateMessage';
import StatCard from '@/components/domain/StatCard';
import ParkingMap from '@/components/domain/ParkingMap';
import RecommendationList from '@/components/domain/RecommendationList';
import EventList from '@/components/domain/EventList';
import DemoSimulatorControls from '@/components/domain/DemoSimulatorControls';

export default function DashboardPage() {
  const { overview, loading, refreshing, error, lastUpdatedAt, refetch } = useDashboard();

  if (loading && !overview) {
    return (
      <>
        <PageHeader
          title="Visão geral"
          description="Monitoramento em tempo real da ocupação estimada dos setores A–G."
        />
        <StateMessage
          variant="loading"
          title="Carregando indicadores do estacionamento..."
        />
      </>
    );
  }

  if (error && !overview) {
    return (
      <>
        <PageHeader
          title="Visão geral"
          description="Monitoramento em tempo real da ocupação estimada dos setores A–G."
        />
        <StateMessage
          variant="error"
          title="Não foi possível carregar o painel"
          description={error.message}
        />
      </>
    );
  }

  const kpis = overview?.kpis || {};
  const sectors = overview?.sectors || [];
  const recommendations = overview?.recommendations || [];
  const recentEvents = overview?.recentEvents || [];
  const activeTickets = overview?.activeTickets || [];
  const recommendedIds = recommendations.map((r) => r.setorId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral operacional"
        description="Acompanhamento de ocupação estimada por setor (A–G), recomendações e fluxo de veículos."
        actions={
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Badge variant="brand" dot>
              Polling ~2,5s
            </Badge>
            <span>
              Atualizado às <strong>{formatTime(lastUpdatedAt || overview?.updatedAt)}</strong>
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

      {/* Indicadores principais (KPIs) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Capacidade total"
          value={`${kpis.capacidadeTotal ?? 0} vagas`}
          subtitle="Soma configurada dos 7 setores (A–G)"
          icon={Building2}
          tone="brand"
        />
        <StatCard
          label="Vagas disponíveis (est.)"
          value={`≈ ${kpis.vagasLivresEstimadas ?? 0}`}
          subtitle={`De ${kpis.capacidadeTotal ?? 0} vagas · Ocupação estimada: ≈ ${kpis.ocupacaoEstimadaTotal ?? 0}`}
          icon={ParkingCircle}
          tone="success"
        />
        <StatCard
          label="Veículos presentes (sessões)"
          value={kpis.veiculosPresentes ?? 0}
          subtitle={`${kpis.sessoesAtivas ?? 0} ativas + ${kpis.pagasAguardandoSaida ?? 0} pagas aguardando saída`}
          icon={Car}
          tone="brand"
        />
        <StatCard
          label="Ocupação geral (est.)"
          value={`≈ ${kpis.percentualOcupacaoGeral ?? 0}%`}
          subtitle={
            kpis.cargaBasePreExistente
              ? `≈ ${kpis.ocupacaoEstimadaTotal ?? 0} vagas (inclui carga inicial simulada de ${kpis.cargaBasePreExistente} na abertura do turno)`
              : `≈ ${kpis.ocupacaoEstimadaTotal ?? 0} de ${kpis.capacidadeTotal ?? 0} vagas ocupadas (estimativa)`
          }
          icon={Activity}
          tone={
            (kpis.percentualOcupacaoGeral ?? 0) >= 80
              ? 'danger'
              : (kpis.percentualOcupacaoGeral ?? 0) >= 60
                ? 'warning'
                : 'success'
          }
        />
      </div>

      {/* Segunda linha de indicadores operacionais */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Sessões ativas"
          value={kpis.sessoesAtivas ?? 0}
          subtitle="Sessões em andamento sem pagamento registrado"
          icon={Clock}
          tone="brand"
        />
        <StatCard
          label="Pagas aguardando saída"
          value={kpis.pagasAguardandoSaida ?? 0}
          subtitle="Sessões pagas na janela de saída (15 min)"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Entradas / Saídas (turno atual)"
          value={`${kpis.totalEntradas ?? 0} / ${kpis.totalSaidas ?? 0}`}
          subtitle={
            kpis.inicioMonitoramentoEm
              ? `Acumulado no turno desde ${formatTime(kpis.inicioMonitoramentoEm)} (${kpis.totalEntradas ?? 0} entradas − ${kpis.totalSaidas ?? 0} saídas = ${kpis.veiculosPresentes ?? 0} presentes)`
              : `${kpis.totalEntradas ?? 0} entradas · ${kpis.totalSaidas ?? 0} saídas registradas`
          }
          icon={ArrowLeftRight}
          tone="brand"
        />
      </div>

      {/* Mapa esquemático dos 7 setores A-G */}
      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Mapa de Ocupação Estimada por Setor (A–G)
            </h2>
            <p className="text-xs text-slate-500">
              Ocupação calculada por setor a partir da carga inicial simulada do turno (
              {kpis.cargaBasePreExistente ?? 0} vagas), eventos de movimentação e ajustes
              administrativos.
            </p>
          </div>
          <Link
            to={ROUTES.ADMIN.SECTORS}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            Gerenciar e ajustar setores →
          </Link>
        </div>

        <ParkingMap sectors={sectors} recommendedIds={recommendedIds} />
      </Card>

      {/* Recomendações + Eventos recentes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
                Setores recomendados para estacionamento
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Ponderação demonstrativa: 70% disponibilidade proporcional + 30% proximidade da
                entrada (cálculo definitivo no backend).
              </p>
            </div>
          </div>
          <RecommendationList recommendations={recommendations} />
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">Movimentações recentes</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Últimas entradas, deslocamentos entre setores, pagamentos e saídas auditadas.
              </p>
            </div>
            <Link
              to={ROUTES.ADMIN.HISTORY}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              Ver histórico completo →
            </Link>
          </div>
          <EventList events={recentEvents} />
        </Card>
      </div>

      {/* Controles discretos de simulação (visível apenas quando VITE_USE_MOCKS=true) */}
      <DemoSimulatorControls activeTickets={activeTickets} onActionComplete={refetch} />
    </div>
  );
}
