import { useState } from 'react';
import { Navigation, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useSectors } from '@/hooks/useSectors';
import { useRecommendations } from '@/hooks/useRecommendations';
import { formatTime } from '@/utils/formatters';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StateMessage from '@/components/ui/StateMessage';
import ParkingMap from '@/components/domain/ParkingMap';
import AvailabilityBadge from '@/components/domain/AvailabilityBadge';
import OccupancyBar from '@/components/domain/OccupancyBar';
import EstimateLabel from '@/components/domain/EstimateLabel';
import AdjustOccupancyModal from '@/components/domain/AdjustOccupancyModal';

export default function SectorsPage() {
  const {
    sectors,
    loading,
    refreshing,
    error,
    lastUpdatedAt,
    adjusting,
    adjustOccupancy,
  } = useSectors();
  const { recommendations } = useRecommendations();

  const [selectedSectorId, setSelectedSectorId] = useState('A');
  const [modalSectorId, setModalSectorId] = useState(null);
  const [lastAdjustmentNotice, setLastAdjustmentNotice] = useState(null);

  const selectedSector =
    sectors.find((s) => s.id === selectedSectorId) || sectors[0] || null;
  const modalSector = sectors.find((s) => s.id === modalSectorId) || null;
  const recommendedIds = recommendations.map((r) => r.setorId);

  const handleConfirmAdjustment = async ({ setorId, novaOcupacao, motivo }) => {
    const result = await adjustOccupancy({ setorId, novaOcupacao, motivo });
    setModalSectorId(null);
    setSelectedSectorId(setorId);
    setLastAdjustmentNotice({
      setorId,
      anterior: result.adjustment.ocupacaoAnterior,
      nova: result.adjustment.novaOcupacao,
      motivo: result.adjustment.motivo,
      horario: result.adjustment.ajustadoEm,
    });
  };

  const columns = [
    {
      key: 'nome',
      header: 'Setor',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedSectorId(row.id)}
          className="inline-flex items-center gap-2 font-bold text-slate-900 hover:text-brand-700 cursor-pointer"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-slate-900 text-xs font-bold text-white">
            {row.id}
          </span>
          {row.nome}
        </button>
      ),
    },
    {
      key: 'capacidade',
      header: 'Capacidade total',
      render: (row) => <span className="font-semibold">{row.capacidade} vagas</span>,
    },
    {
      key: 'ocupacaoEstimada',
      header: 'Ocupação estimada',
      render: (row) => (
        <div className="min-w-44 space-y-1">
          <EstimateLabel sector={row} compact />
          <OccupancyBar sector={row} />
        </div>
      ),
    },
    {
      key: 'vagasLivresEstimadas',
      header: 'Vagas disponíveis (est.)',
      render: (row) => (
        <span className="font-semibold text-slate-900">
          ≈ {row.vagasLivresEstimadas} vagas ({row.freePercent}%)
        </span>
      ),
    },
    {
      key: 'distanciaEntrada',
      header: 'Distância da entrada',
      render: (row) => (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Navigation className="size-3.5" aria-hidden="true" />
          {row.distanciaEntrada} m
        </span>
      ),
    },
    {
      key: 'level',
      header: 'Disponibilidade',
      render: (row) => <AvailabilityBadge sector={row} showFreePercent />,
    },
    {
      key: 'acoes',
      header: 'Correção manual',
      align: 'right',
      render: (row) => (
        <Button
          size="sm"
          variant="secondary"
          icon={SlidersHorizontal}
          onClick={() => setModalSectorId(row.id)}
        >
          Ajustar ocupação
        </Button>
      ),
    },
  ];

  if (loading && sectors.length === 0) {
    return (
      <>
        <PageHeader
          title="Gerenciamento de setores"
          description="Monitoramento e calibração auditada da ocupação estimada dos setores A até G."
        />
        <StateMessage variant="loading" title="Carregando setores A–G..." />
      </>
    );
  }

  if (error && sectors.length === 0) {
    return (
      <>
        <PageHeader
          title="Gerenciamento de setores"
          description="Monitoramento e calibração auditada da ocupação estimada dos setores A até G."
        />
        <StateMessage
          variant="error"
          title="Erro ao carregar setores"
          description={error.message}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de setores (A–G)"
        description="Selecione um setor no mapa esquemático para inspecionar seus indicadores ou realizar correção manual auditada."
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

      {lastAdjustmentNotice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-emerald-300 bg-status-available-soft px-4 py-3 text-xs text-emerald-950"
        >
          <span>
            Ajuste auditado registrado no <strong>Setor {lastAdjustmentNotice.setorId}</strong>:
            ocupação estimada alterada de <strong>{lastAdjustmentNotice.anterior}</strong> para{' '}
            <strong>{lastAdjustmentNotice.nova}</strong> vagas (Motivo: &ldquo;
            {lastAdjustmentNotice.motivo}&rdquo;).
          </span>
          <span className="font-semibold">{formatTime(lastAdjustmentNotice.horario)}</span>
        </div>
      )}

      {/* Mapa interativo + Painel de inspeção do setor selecionado */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Planta interativa dos setores (A–G)
              </h2>
              <p className="text-xs text-slate-500">
                Clique em qualquer setor na planta para visualizar seus detalhes ao lado e calibrar a
                estimativa.
              </p>
            </div>
          </div>

          <ParkingMap
            sectors={sectors}
            recommendedIds={recommendedIds}
            selectedSectorId={selectedSector?.id}
            onSelectSector={(sec) => setSelectedSectorId(sec.id)}
            showInspector={false}
          />
        </Card>

        {selectedSector && (
          <Card className="xl:col-span-4 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-brand-950 text-lg font-bold text-white">
                    {selectedSector.id}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedSector.nome}</h2>
                    <p className="text-xs text-slate-500">Inspeção detalhada do setor</p>
                  </div>
                </div>
                <AvailabilityBadge sector={selectedSector} />
              </div>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Capacidade configurada</dt>
                  <dd className="font-bold text-slate-900">{selectedSector.capacidade} vagas</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Ocupação estimada</dt>
                  <dd className="font-bold text-slate-900">
                    ≈ {selectedSector.ocupacaoEstimada} vagas ({selectedSector.occupancyPercent}%)
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Vagas disponíveis (est.)</dt>
                  <dd className="font-bold text-emerald-700">
                    ≈ {selectedSector.vagasLivresEstimadas} livres
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Percentual de disponibilidade</dt>
                  <dd className="font-bold text-slate-900">{selectedSector.freePercent}% livre</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Distância da entrada</dt>
                  <dd className="font-semibold text-slate-800">
                    {selectedSector.distanciaEntrada} metros
                  </dd>
                </div>
              </dl>

              <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3">
                <OccupancyBar sector={selectedSector} />
                <EstimateLabel sector={selectedSector} />
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4">
              <Button
                variant="primary"
                icon={SlidersHorizontal}
                onClick={() => setModalSectorId(selectedSector.id)}
                className="w-full"
              >
                Corrigir ocupação do {selectedSector.nome}
              </Button>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Exige motivo obrigatório e registra evento de auditoria no histórico.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Tabela comparativa dos 7 setores */}
      <Table columns={columns} data={sectors} />

      <AdjustOccupancyModal
        sector={modalSector}
        open={Boolean(modalSector)}
        onClose={() => setModalSectorId(null)}
        onConfirm={handleConfirmAdjustment}
        loading={adjusting}
      />
    </div>
  );
}
