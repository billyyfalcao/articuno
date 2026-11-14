import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

/**
 * Modal de ajuste administrativo de ocupação estimada de um setor.
 * Exige motivo obrigatório para registro de auditoria.
 */
export default function AdjustOccupancyModal({ sector, open, onClose, onConfirm, loading }) {
  const [novaOcupacao, setNovaOcupacao] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (sector && open) {
      setNovaOcupacao(sector.ocupacaoEstimada);
      setMotivo('');
      setError('');
    }
  }, [sector, open]);

  if (!sector) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsed = Number(novaOcupacao);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > sector.capacidade) {
      setError(`Informe um número inteiro entre 0 e ${sector.capacidade}.`);
      return;
    }
    if (!motivo.trim() || motivo.trim().length < 4) {
      setError('Informe o motivo do ajuste para auditoria (mínimo 4 caracteres).');
      return;
    }
    setError('');
    await onConfirm?.({
      setorId: sector.id,
      novaOcupacao: parsed,
      motivo: motivo.trim(),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Ajustar ocupação — ${sector.nome}`}
      description={`Capacidade: ${sector.capacidade} vagas · Ocupação atual estimada: ${sector.ocupacaoEstimada}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Nova ocupação estimada"
          type="number"
          min={0}
          max={sector.capacidade}
          value={novaOcupacao}
          onChange={(e) => setNovaOcupacao(e.target.value)}
          required
        />
        <Input
          label="Motivo do ajuste (obrigatório para auditoria)"
          placeholder="Ex.: Contagem visual realizada pela equipe de pátio"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          error={error}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            Registrar ajuste
          </Button>
        </div>
      </form>
    </Modal>
  );
}
