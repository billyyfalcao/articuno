# PY-04 — preparação local de eventos

Este módulo não envia HTTP nem cria sessões. O contrato Java ainda não está
confirmado; nomes e semântica abaixo implementam a proposta do plano mestre
apenas como interface interna. Compatibilidade de payload e idempotência no
servidor Java dependem de confirmação no PY-05. Nenhum endpoint Java foi criado.

## Configuração e uso

`cameras.example.json` é um mapa demonstrativo explícito, não configuração
real presumida. Carregue um mapa acordado com a equipe por `CameraMap`.
Os setores são declarados no mapa; câmeras têm IDs únicos e uma rota fixa.
PASSAGE exige dois setores diferentes conhecidos; ENTRY/EXIT não carregam
transição entre setores. A presença em um setor não infere passagem.

Execute este exemplo na pasta do serviço, com o Python do venv:

```python
from datetime import datetime, timezone
from pathlib import Path
from app.events import CameraMap, EventRegistry, Observation, VisionEvent

mapping = CameraMap.model_validate_json(Path('cameras.example.json').read_text())
registry = EventRegistry(mapping)
observation = Observation(
    camera_id='CAM_ENTRADA', event_type='ENTRY', source='ASSISTED',
    plate=None, detected_at=datetime.now(timezone.utc),
)
event = registry.create('operation-entry-001', observation)
payload = event.model_dump_json()
assert registry.retry(VisionEvent.model_validate_json(payload)) == event
assert registry.create('operation-entry-001', observation).event_id == event.event_id
assert registry.create('operation-entry-002', observation).event_id != event.event_id
```

`event_id` é UUID único gerado uma vez, preservado no JSON e em retries. Modelos
são imutáveis, rejeitam campos extras, datas sem fuso e confiança fora de 0..1.
Placas são opcionais, mas quando fornecidas devem estar normalizadas e no
formato brasileiro. Não há correção automática de OCR. ASSISTED/SIMULATION
exigem confiança nula. OCR exige placa, confiança mínima (padrão 0,8) e
`confirmed=True`; uma única leitura fraca não pode produzir evento por esse
serviço. `confirmed` é uma decisão do chamador confiável, não autenticação.

ENTRY assistido/simulado pode ter placa e sessão nulas para futuro registro
manual. PASSAGE/EXIT sem placa precisam de `session_id` conhecido. Este módulo
não verifica existência da sessão, ocupação, pagamento ou direito de saída;
essas decisões pertencem ao Java. Nunca invente uma sessão para satisfazer a
validação.

## Antirrepetição e reenvio

O produtor deve atribuir um `operation_id` estável ao início de cada passagem
física ou ação assistida e reutilizá-lo em todos os frames/reenvios dela.
Uma nova passagem recebe um novo ID, mesmo se for do mesmo veículo/câmera.
Não gere um operation_id por frame e não use somente a placa como operation_id.
Não há rastreador ou detecção automática da fronteira entre passagens neste card.

O registro trata chamadas concorrentes atomicamente. Mesma operação e mesma
identidade retornam exatamente o evento inicial, incluindo timestamp e confiança
iniciais; a atualização do instante/score em frames seguintes não o altera.
Mesma operação com câmera, placa, sessão, origem ou rota conflitante é rejeitada.
`retry(event)` retorna o original apenas se event_id e todo o payload coincidirem;
IDs desconhecidos ou payload alterado são rejeitados. Não há envio nessa chamada.

Estado em memória por instância/processo, limite padrão de 1.000 operações.
Ao atingir o limite, novas operações são rejeitadas; as existentes continuam
repetíveis. Não há limpeza/TTL silencioso que possa transformar retry em evento
novo. Reiniciar o processo perde o registro; não recrie operações incertas após
reinício sem reconciliação. Persistência e estratégia de entrega serão avaliadas
com o contrato Java no PY-05; não há garantia de exactly-once ponta a ponta.

## Aceite e evidências

- Modelos válidos ENTRY/PASSAGE/EXIT, enums de origem, UUID e datas com fuso:
  testes de serialização/roundtrip e smoke local documentado no PR.
- Mapa: rejeição de câmera desconhecida, sentido inverso, rota incompatível,
  setores inexistentes e IDs duplicados.
- Repetições e retries: identidade estável, conflito rejeitado, concorrência,
  próxima passagem legítima e capacidade sem perder retries.
- Sem placa: entrada manual válida; passagem/saída por sessão conhecida;
  ausência de ambos em passagem/saída rejeitada.
- Formato e confiança OCR: validação local e gate explícito de confirmação.
- Contrato aprovado e efeito idempotente no Java: **não verificáveis ainda**.
  Nenhuma integração real ou mockada é alegada neste card.

PY-03/PR #13 permanece separado. Este módulo não importa código da branch OCR
nem modifica APIs de vídeo, Java ou frontend.
