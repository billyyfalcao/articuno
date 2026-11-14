import { useState } from 'react';
import {
  MapPin,
  Maximize2,
  Navigation,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PARKING_MAP_LAYOUT } from '@/config/parkingMap.layout';
import { computeSectorAvailability } from '@/domain/availability';
import { AVAILABILITY_LEVEL } from '@/domain/constants';
import AvailabilityBadge from './AvailabilityBadge';
import OccupancyBar from './OccupancyBar';
import EstimateLabel from './EstimateLabel';
import { cn } from '@/utils/cn';

/**
 * Paleta de cores do mapa de calor dinâmico:
 *  - Verde (> 40% de vagas livres): Disponível
 *  - Amarelo (20% a 40%): Moderado
 *  - Vermelho (0% a 20%): Quase lotado
 */
const HEATMAP_PALETTE = {
  [AVAILABILITY_LEVEL.GREEN]: {
    fill: 'rgba(22, 163, 74, 0.42)',
    hoverFill: 'rgba(22, 163, 74, 0.56)',
    stroke: '#15803d',
    badgeFill: '#14532d',
    badgeStroke: '#86efac',
    pillText: '#dcfce7',
    dotClass: 'bg-status-available',
  },
  [AVAILABILITY_LEVEL.YELLOW]: {
    fill: 'rgba(217, 119, 6, 0.46)',
    hoverFill: 'rgba(217, 119, 6, 0.60)',
    stroke: '#b45309',
    badgeFill: '#78350f',
    badgeStroke: '#fde68a',
    pillText: '#fef3c7',
    dotClass: 'bg-status-moderate',
  },
  [AVAILABILITY_LEVEL.RED]: {
    fill: 'rgba(220, 38, 38, 0.46)',
    hoverFill: 'rgba(220, 38, 38, 0.60)',
    stroke: '#b91c1c',
    badgeFill: '#7f1d1d',
    badgeStroke: '#fca5a5',
    pillText: '#fee2e2',
    dotClass: 'bg-status-full',
  },
};

/**
 * Escalas de zoom:
 *  - 'fit' (Ajustar - padrão): exibe a planta inteira sem barras de rolagem.
 *  - '100': escala de referência (100% da largura do quadro).
 *  - '135': ampliação de 135% com navegação (scroll/pan).
 *  - '175': ampliação de 175% com navegação (scroll/pan).
 */
const ZOOM_MODES = [
  { key: 'fit', label: 'Ajustar', scale: 1, isFit: true },
  { key: '100', label: '100%', scale: 1, isFit: false },
  { key: '135', label: '135%', scale: 1.35, isFit: false },
  { key: '175', label: '175%', scale: 1.75, isFit: false },
];

/**
 * Mapa interativo baseado na planta real do estacionamento do Capim Dourado Shopping,
 * compartilhado entre o Painel Administrativo e a Interface do Motorista.
 *
 * Utiliza `@container` (CSS Container Queries) para adaptar seu layout interno
 * com base na largura real disponível para o componente (e não apenas na largura
 * da janela do navegador), evitando qualquer compressão ou transbordamento.
 *
 * Props:
 *  - sectors: lista dos 7 setores (A–G)
 *  - highlightSectorId: último setor detectado do veículo (Interface do Motorista)
 *  - recommendedIds: IDs dos setores recomendados (#1, #2, #3)
 *  - selectedSectorId: setor selecionado para inspeção
 *  - onSelectSector: callback disparado ao clicar/tocar em um setor
 *  - showInspector: exibe ou oculta o painel lateral interno de detalhes (padrão: true)
 */
export default function ParkingMap({
  sectors = [],
  highlightSectorId = null,
  recommendedIds = [],
  selectedSectorId = null,
  onSelectSector,
  showInspector = true,
  layout = PARKING_MAP_LAYOUT,
  className,
}) {
  const [hoveredSectorId, setHoveredSectorId] = useState(null);
  const [internalSelectedId, setInternalSelectedId] = useState(null);
  const [zoomIndex, setZoomIndex] = useState(0); // 0 = 'fit' (Ajustar: planta inteira visível)

  const currentZoom = ZOOM_MODES[zoomIndex] || ZOOM_MODES[0];
  const viewWidth = layout.viewBox?.width || 788;
  const viewHeight = layout.viewBox?.height || 1024;

  const recommendedRankMap = new Map(
    recommendedIds.map((sectorId, idx) => [sectorId, idx + 1]),
  );

  const enrichedSectors = sectors.map((sector) => ({
    ...sector,
    ...computeSectorAvailability(sector),
  }));

  const effectiveSelectedId = selectedSectorId ?? internalSelectedId;
  const inspectedSectorId =
    hoveredSectorId ||
    effectiveSelectedId ||
    highlightSectorId ||
    enrichedSectors[0]?.id ||
    null;

  const inspectedSector =
    enrichedSectors.find((s) => s.id === inspectedSectorId) || null;
  const inspectedRank = inspectedSector
    ? recommendedRankMap.get(inspectedSector.id) || null
    : null;

  const handleSectorActivate = (sector) => {
    setInternalSelectedId(sector.id);
    onSelectSector?.(sector);
  };

  const handleZoomIn = () =>
    setZoomIndex((idx) => Math.min(ZOOM_MODES.length - 1, idx + 1));
  const handleZoomOut = () => setZoomIndex((idx) => Math.max(0, idx - 1));
  const handleZoomFit = () => setZoomIndex(0);

  return (
    <div
      className={cn(
        '@container w-full overflow-hidden rounded-card border border-slate-200 bg-slate-100/80 p-3 sm:p-4',
        className,
      )}
    >
      {/* Barra superior: título da planta, legenda de disponibilidade e controles de zoom */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-2.5 py-1 font-semibold text-white">
            <MapPin className="size-3.5 shrink-0 text-brand-300" aria-hidden="true" />
            <span>Planta Capim Dourado Shopping (Setores A–G)</span>
          </span>
          <span className="text-[11px] text-slate-600">
            Toque ou passe o mouse sobre um setor para inspecionar
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Legenda das três faixas de disponibilidade */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
              <span className="size-2 rounded-full bg-status-available" />
              Verde (&gt; 40% livres)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
              <span className="size-2 rounded-full bg-status-moderate" />
              Amarelo (20%–40%)
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 ring-1 ring-slate-200">
              <span className="size-2 rounded-full bg-status-full" />
              Vermelho (0%–20%)
            </span>
          </div>

          {/* Controles de zoom: Ajustar (planta inteira), 100%, 135%, 175% */}
          <div
            role="group"
            aria-label="Controles de ampliação do mapa"
            className="inline-flex items-center gap-0.5 rounded-xl bg-white p-1 shadow-2xs ring-1 ring-slate-200"
          >
            <button
              type="button"
              onClick={handleZoomFit}
              aria-pressed={currentZoom.isFit}
              title="Exibir a planta inteira sem barras de rolagem"
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors cursor-pointer',
                currentZoom.isFit
                  ? 'bg-brand-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <Maximize2 className="size-3" aria-hidden="true" />
              Ajustar
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoomIndex === 0}
              aria-label="Reduzir zoom"
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ZoomOut className="size-3.5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-0.5 px-0.5">
              {ZOOM_MODES.slice(1).map((mode, idx) => {
                const modeIndex = idx + 1;
                const active = zoomIndex === modeIndex;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => setZoomIndex(modeIndex)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors cursor-pointer',
                      active
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100',
                    )}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoomIndex === ZOOM_MODES.length - 1}
              aria-label="Ampliar zoom"
              className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
            >
              <ZoomIn className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/*
        Layout responsivo orientado pelo espaço real do contêiner (@container):
        - Em contêineres estreitos/médios (como na Interface do Motorista, tablets ou quando
          o mapa já está ao lado de outro painel), empilha em 1 coluna (mapa em cima, detalhes embaixo).
        - Apenas quando o próprio ParkingMap dispõe de >= 768px (@3xl), posiciona o mapa (8 colunas)
          e o painel de detalhes (4 colunas) lado a lado.
      */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4',
          showInspector && '@3xl:grid-cols-12 @3xl:items-start',
        )}
      >
        {/* Área principal da planta SVG */}
        <div className={cn('min-w-0', showInspector && '@3xl:col-span-8')}>
          <div
            className={cn(
              'rounded-2xl border border-slate-300 bg-slate-900/5 shadow-inner',
              currentZoom.isFit
                ? 'flex items-center justify-center overflow-hidden p-2 sm:p-3'
                : 'max-h-[75dvh] overflow-auto p-2',
            )}
          >
            <div
              className={cn(
                'mx-auto transition-all duration-200',
                currentZoom.isFit && 'flex w-full justify-center',
              )}
              style={
                currentZoom.isFit
                  ? undefined
                  : {
                      width: `${currentZoom.scale * 100}%`,
                      minWidth:
                        currentZoom.scale > 1
                          ? `${Math.round(520 * currentZoom.scale)}px`
                          : '100%',
                    }
              }
            >
              <svg
                viewBox={`0 0 ${viewWidth} ${viewHeight}`}
                role="img"
                aria-label="Mapa interativo da planta do estacionamento com os setores A até G"
                className={cn(
                  'block select-none rounded-xl',
                  currentZoom.isFit
                    ? 'h-auto max-h-[68dvh] w-auto max-w-full'
                    : 'h-auto w-full',
                )}
              >
                <defs>
                  <filter
                    id="sector-badge-shadow"
                    x="-20%"
                    y="-20%"
                    width="140%"
                    height="140%"
                  >
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.35" />
                  </filter>
                </defs>

                {/* Camada 1: Imagem oficial da planta do Capim Dourado Shopping (788 x 1024) */}
                <image
                  href={layout.imageUrl || '/images/planta-capim-dourado.jpg'}
                  x="0"
                  y="0"
                  width={viewWidth}
                  height={viewHeight}
                  preserveAspectRatio="xMidYMid meet"
                />

                {/* Camada 2: Legenda integrada do Mapa de Calor sobre o quadro estático original */}
                {layout.staticLegendBox && (
                  <g aria-hidden="true">
                    <rect
                      x={layout.staticLegendBox.x}
                      y={layout.staticLegendBox.y}
                      width={layout.staticLegendBox.width}
                      height={layout.staticLegendBox.height}
                      rx={layout.staticLegendBox.rx}
                      fill="#0f172a"
                      fillOpacity="0.94"
                      stroke="#334155"
                      strokeWidth="2"
                    />
                    <text
                      x={layout.staticLegendBox.x + 16}
                      y={layout.staticLegendBox.y + 30}
                      fill="#f8fafc"
                      fontSize="14"
                      fontWeight="800"
                      letterSpacing="0.5"
                    >
                      MAPA DE CALOR (EST.)
                    </text>
                    <text
                      x={layout.staticLegendBox.x + 16}
                      y={layout.staticLegendBox.y + 49}
                      fill="#94a3b8"
                      fontSize="11"
                      fontWeight="600"
                    >
                      Disponibilidade por setor
                    </text>

                    <circle
                      cx={layout.staticLegendBox.x + 24}
                      cy={layout.staticLegendBox.y + 82}
                      r="9"
                      fill="#16a34a"
                    />
                    <text
                      x={layout.staticLegendBox.x + 42}
                      y={layout.staticLegendBox.y + 86}
                      fill="#f1f5f9"
                      fontSize="13"
                      fontWeight="700"
                    >
                      Verde: &gt; 40% livres
                    </text>

                    <circle
                      cx={layout.staticLegendBox.x + 24}
                      cy={layout.staticLegendBox.y + 116}
                      r="9"
                      fill="#d97706"
                    />
                    <text
                      x={layout.staticLegendBox.x + 42}
                      y={layout.staticLegendBox.y + 120}
                      fill="#f1f5f9"
                      fontSize="13"
                      fontWeight="700"
                    >
                      Amarelo: 20% a 40%
                    </text>

                    <circle
                      cx={layout.staticLegendBox.x + 24}
                      cy={layout.staticLegendBox.y + 150}
                      r="9"
                      fill="#dc2626"
                    />
                    <text
                      x={layout.staticLegendBox.x + 42}
                      y={layout.staticLegendBox.y + 154}
                      fill="#f1f5f9"
                      fontSize="13"
                      fontWeight="700"
                    >
                      Vermelho: 0% a 20%
                    </text>

                    <rect
                      x={layout.staticLegendBox.x + 15}
                      y={layout.staticLegendBox.y + 174}
                      width="18"
                      height="18"
                      rx="4"
                      fill="#1d4ed8"
                      stroke="#93c5fd"
                      strokeWidth="2"
                    />
                    <text
                      x={layout.staticLegendBox.x + 42}
                      y={layout.staticLegendBox.y + 188}
                      fill="#bfdbfe"
                      fontSize="12"
                      fontWeight="700"
                    >
                      Destaque / Recomendado
                    </text>
                  </g>
                )}

                {/* Camada 3: Regiões interativas dos 7 setores (A até G) */}
                {enrichedSectors.map((sector) => {
                  const region = layout.sectors?.[sector.id];
                  if (!region) return null;

                  const palette =
                    HEATMAP_PALETTE[sector.level] ||
                    HEATMAP_PALETTE[AVAILABILITY_LEVEL.GREEN];
                  const isHovered = hoveredSectorId === sector.id;
                  const isSelected = effectiveSelectedId === sector.id;
                  const isDriverSector = highlightSectorId === sector.id;
                  const recRank = recommendedRankMap.get(sector.id) || null;

                  const centerX = region.x + region.width / 2;
                  const centerY = region.y + region.height / 2;
                  const isCompactRegion = region.height < 80 || region.width < 95;

                  return (
                    <g
                      key={sector.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${sector.nome}: ${sector.meta.label}, cerca de ${sector.vagasLivresEstimadas} vagas livres de ${sector.capacidade} (${sector.freePercent}% livre)`}
                      onClick={() => handleSectorActivate(sector)}
                      onMouseEnter={() => setHoveredSectorId(sector.id)}
                      onMouseLeave={() => setHoveredSectorId(null)}
                      onFocus={() => setHoveredSectorId(sector.id)}
                      onBlur={() => setHoveredSectorId(null)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSectorActivate(sector);
                        }
                      }}
                      className="cursor-pointer focus:outline-none"
                    >
                      <title>
                        {`${sector.nome} — ${sector.meta.label}\nCapacidade: ${sector.capacidade} vagas\nOcupação estimada: ≈ ${sector.ocupacaoEstimada} vagas\nDisponíveis (est.): ≈ ${sector.vagasLivresEstimadas} (${sector.freePercent}%)\nDistância da entrada: ${sector.distanciaEntrada} m`}
                      </title>

                      {/* 3.1 Neutralização suave do matiz fixo original da imagem */}
                      <rect
                        x={region.x}
                        y={region.y}
                        width={region.width}
                        height={region.height}
                        rx={region.rx || 8}
                        fill="#f8fafc"
                        fillOpacity="0.48"
                      />

                      {/* 3.2 Preenchimento semitransparente do mapa de calor (Verde / Amarelo / Vermelho) */}
                      <rect
                        x={region.x}
                        y={region.y}
                        width={region.width}
                        height={region.height}
                        rx={region.rx || 8}
                        fill={isHovered || isSelected ? palette.hoverFill : palette.fill}
                        stroke={palette.stroke}
                        strokeWidth={isHovered || isSelected ? 5 : 3.5}
                      />

                      {/* 3.3 Contorno de seleção administrativa */}
                      {isSelected && !isDriverSector && (
                        <rect
                          x={region.x - 4}
                          y={region.y - 4}
                          width={region.width + 8}
                          height={region.height + 8}
                          rx={(region.rx || 8) + 3}
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="3"
                          strokeDasharray="8 4"
                        />
                      )}

                      {/* 3.4 Contorno duplo do último setor detectado para o motorista */}
                      {isDriverSector && (
                        <>
                          <rect
                            x={region.x - 6}
                            y={region.y - 6}
                            width={region.width + 12}
                            height={region.height + 12}
                            rx={(region.rx || 8) + 4}
                            fill="none"
                            stroke="#1d4ed8"
                            strokeWidth="5"
                          />
                          <rect
                            x={region.x - 11}
                            y={region.y - 11}
                            width={region.width + 22}
                            height={region.height + 22}
                            rx={(region.rx || 8) + 7}
                            fill="none"
                            stroke="#60a5fa"
                            strokeWidth="2.5"
                            strokeDasharray="10 6"
                          />
                        </>
                      )}

                      {/* 3.5 Placa central com a letra do setor (A–G) e % livre */}
                      <g filter="url(#sector-badge-shadow)">
                        <rect
                          x={centerX - (isCompactRegion ? 36 : 46)}
                          y={centerY - (isCompactRegion ? 22 : 28)}
                          width={isCompactRegion ? 72 : 92}
                          height={isCompactRegion ? 44 : 56}
                          rx="12"
                          fill={palette.badgeFill}
                          fillOpacity="0.92"
                          stroke={palette.badgeStroke}
                          strokeWidth="2"
                        />
                        <text
                          x={centerX}
                          y={centerY - (isCompactRegion ? 2 : 4)}
                          textAnchor="middle"
                          fill="#ffffff"
                          fontSize={isCompactRegion ? '20' : '24'}
                          fontWeight="900"
                        >
                          {sector.id}
                        </text>
                        <text
                          x={centerX}
                          y={centerY + (isCompactRegion ? 14 : 18)}
                          textAnchor="middle"
                          fill={palette.pillText}
                          fontSize={isCompactRegion ? '11' : '12'}
                          fontWeight="800"
                        >
                          {`${sector.freePercent}% livre`}
                        </text>
                      </g>

                      {/* 3.6 Indicador de setor recomendado (#1, #2, #3) */}
                      {recRank && (
                        <g filter="url(#sector-badge-shadow)">
                          <rect
                            x={region.x + 8}
                            y={region.y + 8}
                            width="46"
                            height="24"
                            rx="8"
                            fill="#0f172a"
                            stroke="#38bdf8"
                            strokeWidth="2"
                          />
                          <text
                            x={region.x + 31}
                            y={region.y + 24}
                            textAnchor="middle"
                            fill="#e0f2fe"
                            fontSize="12"
                            fontWeight="900"
                          >
                            {`#${recRank} ★`}
                          </text>
                        </g>
                      )}

                      {/* 3.7 Marcador do último setor detectado para o motorista */}
                      {isDriverSector && (
                        <g filter="url(#sector-badge-shadow)">
                          <rect
                            x={centerX - 78}
                            y={region.y - 34}
                            width="156"
                            height="26"
                            rx="9"
                            fill="#1d4ed8"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                          <text
                            x={centerX}
                            y={region.y - 17}
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize="11"
                            fontWeight="800"
                          >
                            Último setor detectado
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Barra rápida de seleção por toque (A até G) */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold text-slate-500">
              Seleção rápida:
            </span>
            {enrichedSectors.map((sector) => {
              const palette =
                HEATMAP_PALETTE[sector.level] || HEATMAP_PALETTE[AVAILABILITY_LEVEL.GREEN];
              const active = inspectedSector?.id === sector.id;
              const isDriver = highlightSectorId === sector.id;
              const recRank = recommendedRankMap.get(sector.id);

              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => handleSectorActivate(sector)}
                  onMouseEnter={() => setHoveredSectorId(sector.id)}
                  onMouseLeave={() => setHoveredSectorId(null)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer',
                    active
                      ? 'bg-slate-900 text-white shadow-xs ring-2 ring-brand-500'
                      : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', palette.dotClass)} />
                  <span>Setor {sector.id}</span>
                  <span className="text-[11px] font-medium opacity-80">
                    ({sector.freePercent}%)
                  </span>
                  {recRank && (
                    <span className="rounded bg-brand-100 px-1 text-[10px] font-extrabold text-brand-900">
                      {`#${recRank}`}
                    </span>
                  )}
                  {isDriver && (
                    <span className="rounded bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Você
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel de detalhes do setor selecionado/inspecionado (lado a lado em @3xl, abaixo em telas menores) */}
        {showInspector && (
          <div className="min-w-0 @3xl:col-span-4 flex flex-col justify-between rounded-2xl border border-slate-200 bg-surface p-4 shadow-xs">
            {inspectedSector ? (
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-base font-extrabold text-white">
                      {inspectedSector.id}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="text-base font-extrabold text-slate-900">
                          {inspectedSector.nome}
                        </h3>
                        {inspectedRank && (
                          <span className="inline-flex items-center gap-0.5 rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] font-bold text-brand-900">
                            <Sparkles className="size-3" aria-hidden="true" />
                            {`#${inspectedRank}`}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {hoveredSectorId
                          ? 'Visualizando setor sob o cursor'
                          : 'Resumo do setor selecionado'}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    <AvailabilityBadge sector={inspectedSector} />
                  </div>
                </div>

                {highlightSectorId === inspectedSector.id && (
                  <div className="mt-3 rounded-xl bg-brand-700 px-3 py-2 text-xs font-semibold text-white">
                    Último setor detectado para este veículo
                  </div>
                )}

                <dl className="mt-3.5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Situação atual</dt>
                    <dd className="font-bold text-slate-900">{inspectedSector.meta.label}</dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Capacidade total</dt>
                    <dd className="font-bold text-slate-900">
                      {inspectedSector.capacidade} vagas
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Ocupação estimada</dt>
                    <dd className="font-bold text-slate-900">
                      ≈ {inspectedSector.ocupacaoEstimada} vagas (
                      {inspectedSector.occupancyPercent}%)
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Vagas disponíveis (est.)</dt>
                    <dd className="font-bold text-emerald-700">
                      ≈ {inspectedSector.vagasLivresEstimadas} vagas
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Percentual de disponibilidade</dt>
                    <dd className="font-extrabold text-slate-900">
                      {inspectedSector.freePercent}% livre
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <dt className="text-slate-500">Distância aprox. da entrada</dt>
                    <dd className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <Navigation className="size-3 text-brand-600" aria-hidden="true" />
                      {inspectedSector.distanciaEntrada} m
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3">
                  <OccupancyBar sector={inspectedSector} />
                  <EstimateLabel sector={inspectedSector} />
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Selecione um setor na planta para visualizar seus indicadores.
              </p>
            )}

            <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              Planta oficial do estacionamento com camada de calor dinâmica por setor. Os valores
              representam estimativas (o sistema não identifica vagas individuais).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
