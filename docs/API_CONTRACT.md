# Contrato REST — eventos de visão (JV-02)

Versão 1, 14/11/2026. Implementado a partir dos modelos reais
`backend/parking-vision-python/app/events.py` e do cliente `app/java_client.py`.
Nenhum arquivo funcional Python foi modificado. Este contrato cobre **registro
de eventos**, não sessões, tickets, ocupação, pagamento ou autorização de saída.

## Transporte e autenticação

- `POST /api/v1/internal/vision-events`, `Content-Type: application/json`.
- `GET /api/v1/internal/vision-events/{event_id}` para consulta autenticada.
- As duas rotas exigem exatamente um header `X-Internal-API-Key`.
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
  de session_id; neste card a existência da sessão ainda não é verificada.
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
JV-02 valida a estrutura do evento; registro de câmeras, mapa permitido, sessão
existente, capacidade e efeitos de transições serão responsabilidade do JV-03.
Um EXIT registrado aqui **não autoriza cancela nem encerra sessão**.

## Resposta e idempotência

POST retorna **200** após o registro no SQLite, tanto na primeira operação
quanto em replay idêntico. Exemplo de forma (timestamp ilustrativo):

```json
{
  "event_id": "00000000-0000-0000-0000-000000000001",
  "status": "RECORDED",
  "received_at": "2026-11-14T12:30:01Z"
}
```

`received_at` é o instante de recebimento no Java, preservado em retries;
`detected_at` pertence ao produtor. A resposta original é persistida e devolvida
sem alteração, inclusive após reinício. Não contém sessão, ticket ou pagamento.

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
para conferir o recibo. Isso não equivale a efeitos de negócio do futuro JV-03.

GET retorna 200 com `{"event": {...}, "receipt": {...}}`: evento canônico e
recibo original. Evento inexistente retorna 404. Consulta não cria registros.
Esta é uma rota entre serviços/operadores autorizados, não uma API pública
para o navegador receber a chave interna.

## Erros

| HTTP | error | Situação |
|---|---|---|
| 400 | invalid_json | JSON vazio, malformado, duplicado, número não representável pelo parser ou tokens adicionais |
| 401 | unauthorized | Chave ausente/incorreta ou múltiplos headers de chave |
| 404 | event_not_found | UUID válido ainda não registrado |
| 409 | event_id_conflict | ID existente com conteúdo lógico diferente |
| 413 | payload_too_large | Corpo acima de 16 KiB |
| 415 | Resposta padrão sanitizada Spring | Content-Type não suportado |
| 422 | invalid_event | Campo/regra inválida; field identifica apenas nome conhecido ou body |
| 503 | receiver_not_configured | Chave interna ausente/vazia no Java |
| 503 | database_unavailable | Falha de acesso ao SQLite durante a requisição |

Erros próprios retornam `{"error":"codigo"}`, com `field` opcional em 422.
Não ecoam chave, placa, texto JSON, SQL ou stack trace. Métodos não suportados
preservam HTTP 405. Não há papéis de autorização distintos que exijam 403 neste
card. Erros inesperados continuam 500 com detalhes HTTP desabilitados.

## Persistência e evolução

Migração transacional de schema_version 1 para 2 preserva dados anteriores e
adiciona vision_events(event_id PK, payload_json, receipt_json). Banco ausente
é inicializado; esquema desconhecido/inconsistente impede startup. Guardar
cópia do banco antes de atualizar; o binário antigo JV-01 não aceita schema 2.
Não apontar Python diretamente ao arquivo SQLite do Java.

Eventos deste card são recibos técnicos; não devem ser interpretados como
sessões retroativamente processadas. JV-03 deverá definir efeitos de negócio e
evolução compatível sem alterar silenciosamente recibos já emitidos.

Execução/testes do receptor: [JV02_RECEIVER.md](../backend/parking-core-java/JV02_RECEIVER.md).
