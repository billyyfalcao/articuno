import { Link, useOutletContext, useParams } from 'react-router';
import { Clock, Info, MapPin, Navigation, Ticket } from 'lucide-react';
import { buildTicketPath } from '@/routes/paths';
import { formatDateTime, formatPlate, formatTime } from '@/utils/formatters';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import ParkingMap from '@/components/domain/ParkingMap';
import AvailabilityBadge from '@/components/domain/AvailabilityBadge';
import EstimateLabel from '@/components/domain/EstimateLabel';

/**
 * Página de localização do veículo (/ticket/:token/localizacao):
 * Exibe somente o último setor em que o veículo foi detectado, acompanhado
 * do horário da identificação e do componente ParkingMap com destaque.
 * Não implementa identificação de vaga individual, andar ou rota passo a passo.
 */
export default function LocationPage() {
  const { token } = useParams();
  const { ticket } = useOutletContext();

  const currentSector =
    ticket.sectors?.find((s) => s.id === ticket.ultimoSetorId) || null;

  return (
    <div className="space-y-4">
      {/* Destaque do último setor identificado + horário */}
      <Card className="border-l-4 border-l-brand-700">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-700 text-xl font-extrabold text-white shadow-xs">
              {ticket.ultimoSetorId}
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                Último setor identificado
              </p>
              <h1 className="text-lg font-extrabold text-slate-900">
                {ticket.ultimoSetorNome}
              </h1>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                <Clock className="size-3.5 text-slate-400" aria-hidden="true" />
                Identificado às <strong>{formatTime(ticket.ultimaDeteccaoEm)}</strong> (
                {formatDateTime(ticket.ultimaDeteccaoEm)})
              </p>
            </div>
          </div>

          {currentSector && <AvailabilityBadge sector={currentSector} />}
        </div>

        {currentSector && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <EstimateLabel sector={currentSector} compact />
            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
              <Navigation className="size-3.5 text-brand-600" aria-hidden="true" />
              Distância da entrada: {currentSector.distanciaEntrada} m
            </span>
          </div>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-brand-50/80 p-3 text-xs text-brand-950">
          <Info className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
          <span>
            O sistema realiza o monitoramento por setor e <strong>não identifica vagas individuais</strong>.
            A indicação acima refere-se ao último setor em que o veículo ({formatPlate(ticket.placa)})
            foi detectado pelos sensores.
          </span>
        </div>
      </Card>

      {/* Mapa esquemático dos setores A-G com o setor do motorista em destaque */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <MapPin className="size-4 text-brand-700" aria-hidden="true" />
            Posição do {ticket.ultimoSetorNome} no estacionamento
          </h2>
        </div>

        <ParkingMap
          sectors={ticket.sectors || []}
          highlightSectorId={ticket.ultimoSetorId}
        />
      </Card>

      <Link to={buildTicketPath(token)} className="block">
        <Button variant="secondary" icon={Ticket} className="w-full justify-center py-3">
          Voltar para o resumo do ticket
        </Button>
      </Link>
    </div>
  );
}
