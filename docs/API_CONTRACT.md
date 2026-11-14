# Contrato REST — eventos, sessões e setores (JV-02 / JV-03)

Versão 2, 14/11/2026. Implementado a partir dos modelos reais
`backend/parking-vision-python/app/events.py` e do cliente `app/java_client.py`.
Nenhum arquivo funcional Python foi modificado. JV-03 acrescenta sessões,
setores e ocupação estimada aos novos eventos. Tickets, pagamento e autorização
de saída permanecem pendentes; EXIT fica bloqueado até JV-06.

## Transporte e autenticação

- `POST /api/v1/internal/vision-events`, `Content-Type: application/json`.
- `GET /api/v1/internal/vision-events/{event_id}` para consulta autenticada.
- Consultas de sessões, setores e indicadores na mesma área interna, abaixo.
- Todas as rotas internas exigem exatamente um header `X-Internal-API-Key`.
- Java: configurar `INTERNAL_API_KEY` com 32..256 caracteres ASCII imprimíveis,
  sem espaços; nenhum valor padrão. Ausente/vazia desabilita rotas internas
  com 503, mantendo `/health`; configuração não vazia inválida impede startup.
  A chave é literal: sequências como `${...}` não são interpoladas pelo Java.
- Python: configurar a mesma chave, `JAVA_API_BASE_URL` com a origem do Java
  e `JAVA_EVENTS_ENDPOINT=/api/v1/internal/vision-events`.
- Chave somente nos servidores; não usar query, JSON, frontend ou logs.
  Comparação de chave em tempo constante. Autenticação precede leitura do JSON.
- Usar loopback na demo local; HTTPS e controle de acesso são necessários fora
  da máquina. Este card não disponibiliza acesso público ou CORS administrativo.

## Corpo do evento

| Campo | Tipo / regra |
|---|---|
| event_id | Obrigatório; UUID no formato com hífens, gerado pelo Python e reutilizado em retries |
| camera_id | Obrigatório; texto não vazio, sem whitespace, até 128 caracteres Unicode |
| event_type | Obrigatório; ENTRY, PASSAGE ou EXIT |
| plate | Texto opcional/null; quando presente, padrão brasileiro ABC1234 ou ABC1D23 em maiúsculas |
| session_id | Identificador opcional/null, até 128 caracteres, não vazio e sem whitespace |
| origin_sector | Identificador opcional/null com as mesmas restrições |
| destination_sector | Identificador opcional/null com as mesmas restrições |
| detected_at | Obrigatório; texto ISO 8601 com fuso explícito, como 2026-11-14T09:30:00-03:00 ou 2026-11-14T12:30:00Z |
| confidence | Número opcional/null, finito e entre 0 e 1 |
| source | Obrigatório; OCR, ASSISTED ou SIMULATION (não SIMULATED) |

Regras cruzadas:

- PASSAGE exige origem e destino presentes e distintos. ENTRY/EXIT exigem
  ambos nulos/ausentes.
- ENTRY aceita ausência de placa e sessão. PASSAGE/EXIT sem placa precisam
  de session_id existente. Regras de identidade/sessão estão detalhadas abaixo.
- OCR exige placa válida e confidence; ASSISTED/SIMULATION exigem confidence
  nula/ausente. O gate de confirmação e confiança mínima do emissor Python
  permanece no PY-04; este receptor não executa OCR ou inventa evidência.
- Campos extras, tipos incorretos e coerção de strings numéricas são rejeitados.
  Os formatos acima são os emitidos por `VisionEvent.model_dump_json()`.
- Datas aceitam `Z` ou offset `±HH:MM` inferior a 24 horas, inclusive offsets
  acima de 18 horas emitidos pelo Python. Datas são armazenadas e consultadas
  como instantes UTC.
- Limite do corpo: 16.384 bytes. JSON vazio, malformado, com campos duplicados
  ou conteúdo adicional após o objeto é rejeitado.
- Não enviar operation_id: ele pertence ao registro local Python. A identidade
  entre serviços é event_id. Não usar os IDs textuais dos exemplos iniciais do
  plano mestre: o modelo Python integrado gera UUIDs.

Exemplo fictício, explicitamente simulado:

```json
{
  "event_id": "00000000-0000-0000-0000-000000000001",
  "camera_id": "CAM_ENTRADA",
  "event_type": "ENTRY",
  "plate": "ABC1D23",
  "session_id": null,
  "origin_sector": null,
  "destination_sector": null,
  "detected_at": "2026-11-14T09:30:00-03:00",
  "confidence": null,
  "source": "SIMULATION"
}
```

Para PASSAGE usar CAM_A_B, origem A/destino B e novo event_id; para EXIT usar
CAM_SAIDA, setores nulos e novo event_id. São as câmeras de exemplo do Python.
O Java valida câmera/rota pelo CORE_LAYOUT_PATH, além da estrutura do evento.
ENTRY/EXIT continuam sem origin_sector/destination_sector no JSON: o setor
associado à câmera vem da configuração Java. Um EXIT **não autoriza cancela
nem encerra sessão** enquanto não houver política do JV-06.

## Regras de sessão e capacidade — JV-03

- ENTRY gera session_id UUID no Java e inicia sessão ACTIVE no setor da câmera.
  Placa é opcional; não inventar placa. ENTRY com session_id é rejeitado com 422
  entry_session_not_allowed. Placa com sessão já ativa retorna 409 active_session_exists.
- Sem placa, consultar o recibo e reutilizar o session_id retornado em PASSAGE/EXIT.
  Diferentes event_ids de entrada sem placa representam operações distintas;
  o sistema não consegue deduzir que são o mesmo veículo anônimo.
- PASSAGE/EXIT: session_id informado identifica a sessão; se também houver placa,
  ela precisa corresponder à placa armazenada. Sem session_id, buscar sessão ativa
  por placa. Sessão ausente: 404 session_not_found; identidade divergente:
  409 session_identity_conflict. Não há associação automática de placa a sessão anônima.
- PASSAGE exige sessão ACTIVE no setor de origem, rota exatamente igual à câmera
  configurada e capacidade disponível no destino. Só então atualiza setor estimado
  e última data. Transição de setor incompatível retorna 409 invalid_session_transition;
  câmera/rota desconhecida retorna 422 invalid_camera_transition.
- detected_at anterior à última operação aceita da sessão retorna 409 stale_event.
  Datas iguais são aceitas, permitindo câmeras com a mesma resolução temporal.
- Ocupação é contagem de sessões ACTIVE por setor, identificada como **estimada**.
  Não existe vaga individual nem contador independente que acumule duplicações.
  Setor cheio retorna 409 sector_full; ENTRY/PASSAGE não cria/move sessão nesse caso.
- EXIT exige sessão/identidade/setor/data coerentes e então retorna
  **403 exit_authorization_required**, mantendo sessão ACTIVE e ocupação.
  Não existe concessão manual, flag de liberação ou pagamento fictício neste card.
  Encerramento autorizado é critério **bloqueado pelo JV-06**.

## Resposta e idempotência

POST de ENTRY/PASSAGE aceito retorna **200** após o commit no SQLite, tanto
na primeira operação quanto em replay. Exemplo ilustrativo de entrada:

```json
{
  "event_id": "00000000-0000-0000-0000-000000000001",
  "received_at": "2026-11-14T12:30:01Z",
  "status": "APPLIED",
  "session_id": "00000000-0000-0000-0000-000000000010",
  "sector_id": "A",
  "session_status": "ACTIVE"
}
```

`received_at` é o instante de recebimento no Java, preservado em retries;
`detected_at` pertence ao produtor. A resposta original é persistida e devolvida
sem alteração, inclusive após reinício. Não contém ticket ou pagamento.
O setor no recibo é o resultado daquela operação; consultar /sessions/{id}
para o setor atual, que pode ter mudado depois.

Rejeições de negócio também são persistidas, com HTTP original (403/404/409/422)
e recibo {event_id, received_at, status: REJECTED, error}. Nenhum efeito parcial
de sessão permanece. Reenvio devolve a mesma rejeição mesmo se o contexto mudar;
uma tentativa posterior legítima após resolver o motivo exige novo event_id.
Isso também valerá para nova tentativa de saída após futura autorização.
JSON/campos inválidos, autenticação e conflito de conteúdo de ID existente não
geram novo registro. Falha SQL retorna 503 e reverte evento, recibo e sessão.

A chave primária event_id arbitra concorrência no banco. Comparação de conteúdo
usa representação canônica: ordem/whitespace JSON não importam; opcionais
ausentes equivalem a null; UUID é normalizado, datas equivalentes ao mesmo
instante são comparadas em UTC e 0.90 equivale a 0.9. Qualquer alteração dos
demais valores para um event_id existente retorna **409** e preserva o original.

Nova passagem legítima exige novo event_id. A idempotência não expira nem é
apagada automaticamente. Não gerar outro ID após timeout: o registro pode ter
sido confirmado mesmo sem resposta ao cliente. Reenviar o mesmo evento.

`JAVA_IDEMPOTENCY_CONFIRMED=true` pode ser usado para este receptor JV-02,
mantendo timeout/retries limitados do cliente Python. O cliente atual descarta
o corpo da resposta e registra HTTP_ACKNOWLEDGED; consultar o GET autenticado
para conferir recibo e session_id. HTTP_ACKNOWLEDGED sozinho não mostra o estado
de negócio; a demo consulta também as sessões Java. Rejeição 403/409 no Java
aparece como delivery FAILED no envelope HTTP 200 do endpoint /send do FastAPI.

GET retorna 200 com `{"event": {...}, "receipt": {...}, "http_status": 200}`:
evento canônico, recibo e status HTTP original; http_status pode ser uma rejeição.
Evento inexistente retorna 404. Consulta não cria registros.
Esta é uma rota entre serviços/operadores autorizados, não uma API pública
para o navegador receber a chave interna.

## Erros

| HTTP | error | Situação |
|---|---|---|
| 400 | invalid_json | JSON vazio, malformado, duplicado, número não representável pelo parser ou tokens adicionais |
| 401 | unauthorized | Chave ausente/incorreta ou múltiplos headers de chave |
| 403 | exit_authorization_required | Saída bloqueada; autorização JV-06 ainda indisponível |
| 404 | event_not_found | UUID válido ainda não registrado |
| 404 | session_not_found | Sessão inexistente ou placa sem sessão ativa |
| 409 | event_id_conflict | ID existente com conteúdo lógico diferente |
| 409 | active_session_exists / session_identity_conflict / session_not_active | Conflito com sessão existente |
| 409 | invalid_session_transition / stale_event / sector_full | Setor, ordem temporal ou capacidade impedem operação |
| 413 | payload_too_large | Corpo acima de 16 KiB |
| 415 | Resposta padrão sanitizada Spring | Content-Type não suportado |
| 422 | invalid_event | Campo/regra inválida; field identifica apenas nome conhecido ou body |
| 422 | invalid_camera_transition / entry_session_not_allowed | Câmera/rota não configurada ou ENTRY com session_id |
| 503 | receiver_not_configured | Chave interna ausente/vazia no Java |
| 503 | database_unavailable | Falha de acesso ao SQLite durante a requisição |

Erros antes do registro retornam `{"error":"codigo"}`, com `field` opcional
em 422; rejeições persistidas incluem os dados do recibo descritos acima.
Não ecoam chave, placa, texto JSON, SQL ou stack trace. Métodos não suportados
preservam HTTP 405. Erros inesperados continuam 500 com detalhes HTTP desabilitados.

## Consultas internas

Todas exigem chave de serviço. Não são rotas para entregar a chave ao navegador;
integração/autenticação administrativa React ainda depende de etapa própria.

| GET | Resposta 200 |
|---|---|
| /api/v1/internal/sessions?limit=50&offset=0 | items, limit, offset; limite 1..100, offset >= 0; mais recentes primeiro |
| /api/v1/internal/sessions/{session_id} | session_id, plate (nullable), sector_id, status, entered_at, last_detected_at, location_estimated: true |
| /api/v1/internal/sectors | estimated: true, items com sector_id, capacity, occupied_estimated e free_estimated |
| /api/v1/internal/dashboard | estimated: true, total_capacity, occupied_estimated, free_estimated, active_sessions, exit_policy: BLOCKED_PENDING_JV06 |

Lista vazia retorna items vazio. Sessão inexistente retorna 404; paginação fora
dos limites retorna 422, tipo de parâmetro inválido retorna 400. Cada consulta
de setores/indicadores usa um único snapshot SQL, sem misturar contagens.

## Configuração do estacionamento

CORE_LAYOUT_PATH aponta arquivo JSON local (até 64 KiB), padrão
./parking.example.json. Setores: sector_id e capacity inteiro 1..1.000.000.
Câmeras: camera_id e event_type; ENTRY/EXIT exigem sector_id; PASSAGE exige
origin_sector e destination_sector distintos. Campos desconhecidos, IDs
duplicados, referências inválidas e capacidade como texto são rejeitados no startup.

O exemplo configura A/B com 20 cada, entrada em A, passagem A→B e saída em B:
**configuração de demonstração, não medição de um estacionamento real**.
Topologia (IDs/setores/rotas) fica vinculada ao banco: mudança exige migração
explícita, não remapeamento silencioso de sessões. Capacidade pode mudar no
restart se não ficar abaixo da ocupação ativa. A atualização é transacional.

## Persistência e evolução

Migração transacional 1→2→3 preserva dados anteriores. Schema 3 adiciona
http_status aos vision_events, parking_sectors e parking_sessions, chaves
estrangeiras e unicidade de placa ativa. BEGIN IMMEDIATE serializa verificações
de capacidade e mudanças; evento/recibo/sessão têm commit único, também entre
duas instâncias. Banco ausente é inicializado; esquema desconhecido/inconsistente
impede startup. Guardar cópia antes de atualizar; binários antigos não aceitam schema 3.
Não apontar Python diretamente ao arquivo SQLite do Java.

Recibos legados JV-02 conservam status RECORDED, HTTP 200 e conteúdo original,
sem sessão retroativa e sem tentar aplicar regras novas durante replay. Para
ensaiar sessões, usar banco de demonstração próprio e novos eventos de entrada.

Execução/testes atuais: [JV03_SESSIONS.md](../backend/parking-core-java/JV03_SESSIONS.md).
Evidências históricas: [JV02_RECEIVER.md](../backend/parking-core-java/JV02_RECEIVER.md).
