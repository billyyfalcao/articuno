# PY-06 — simulador local de câmeras

O simulador usa o `EventRegistry` do PY-04. Não chama Java, não cria sessões,
não gera ticket, não altera ocupação e não autoriza saída. Use uma instância
Uvicorn com um worker, ligada a 127.0.0.1 conforme o README. Não exponha os
controles sem autenticação em rede pública; CORS não é autenticação.

Com PY-05, criar o evento continua local; existe envio HTTP **explícito** em
`POST /api/v1/vision/events/{event_id}/send`. Configuração, resultados e mock
estão em [HTTP_CLIENT.md](HTTP_CLIENT.md). Os exemplos NOT_SENT/UNAVAILABLE
abaixo descrevem o modo padrão sem transporte configurado.

Abra `http://127.0.0.1:8000/docs` para executar as operações via Try it out.
Não é necessário frontend React. Consulte `GET /api/v1/vision/cameras` antes
de selecionar a câmera: a resposta identifica modo LOCAL_SIMULATOR, mapa e
ausência de hardware conectado. O padrão é `cameras.example.json`, mapa
demonstrativo com CAM_ENTRADA, CAM_A_B e CAM_SAIDA. Para outro mapa, configure
`CAMERA_CONFIG` com caminho absoluto de um JSON compatível com `CameraMap`.
Arquivo ausente/inválido impede startup com mensagem sanitizada.

## Fluxo demonstrável

Envie cada corpo abaixo a `POST /api/v1/vision/events/simulate`:

```json
{"operation_id":"demo-entry-1","camera_id":"CAM_ENTRADA","event_type":"ENTRY","plate":"ABC1D23","source":"SIMULATION"}
```

```json
{"operation_id":"demo-ab-1","camera_id":"CAM_A_B","event_type":"PASSAGE","origin_sector":"A","destination_sector":"B","plate":"ABC1D23","source":"SIMULATION"}
```

```json
{"operation_id":"demo-exit-1","camera_id":"CAM_SAIDA","event_type":"EXIT","plate":"ABC1D23","source":"SIMULATION"}
```

Respostas 200 contêm `event` e, sempre, os marcadores:

```json
{"status":"LOCAL_VALIDATED","delivery":"NOT_SENT","java_integration":"UNAVAILABLE"}
```

Esses marcadores são estado local, não resposta de Java. Não há campo de sessão
gerada ou ticket fictício. Uma saída local válida não significa cancela autorizada.
`detected_at` é opcional na requisição: o padrão é agora em UTC. Se informado,
deve conter fuso. Placa deve ser normalizada: ABC1234 ou ABC1D23. Confiança manual
é nula. Origens aceitas: ASSISTED ou SIMULATION (valor definido pelo PY-04;
SIMULATED não é um enum válido). OCR não é aceito por este endpoint.

Reenvie o mesmo corpo com o mesmo `operation_id`: event_id e resultado
originais são preservados; o histórico não cresce. Uma nova passagem recebe
novo operation_id. Nunca gere outro ID para contornar uma resposta incerta.
Usar o mesmo ID com outra identidade retorna 422. Transição B→A em CAM_A_B,
câmera desconhecida, placa inválida e origem OCR também retornam 422.

## Operação sem placa e fallback

Quando não houver leitura disponível, use ASSISTED e informe manualmente uma
placa real conhecida ou `null`, sem inventar leitura/confiança. Entrada sem placa:

```json
{"operation_id":"manual-entry-1","camera_id":"CAM_ENTRADA","event_type":"ENTRY","plate":null,"source":"ASSISTED"}
```

Isso registra somente um evento local. PASSAGE/EXIT sem placa exigem um
`session_id` já conhecido, conforme PY-04. O serviço não cria esse ID nem
verifica existência no Java. Os testes usam uma string explicitamente de fixture;
não é evidência de sessão registrada. Sem placa nem sessão conhecida, a passagem
ou saída é rejeitada, e a integração real desse fluxo permanece bloqueada.

## Histórico, resultados e limites

- `GET /api/v1/vision/events?offset=0&limit=50`: total e eventos aceitos em ordem
  de criação, até 100 por página. Inclui origem e os marcadores locais.
- `GET /api/v1/vision/events/{event_id}`: resultado do evento, ou 404.
- Erros de validação são respostas HTTP 422, não eventos aceitos no histórico.
- Estado e deduplicação por processo, em memória. Reinício perde o histórico.
  Limite de 1.000 operações do PY-04; sem remoção silenciosa que quebre retries.
- A API não aplica regras de negócio de ordenação de sessões, pagamento,
  ocupação ou saída. Essas responsabilidades continuam no Java.

## Aceite local e dependências bloqueadas

Testes automatizados cobrem entrada, A→B, saída, entrada sem placa, passagem/
saída com session_id de fixture, retries concorrentes, conflitos, transições
inválidas, histórico paginado, consulta individual e mapa personalizado.

Bloqueados pelo Java/PY-05: envio HTTP, resposta real de sessão/ticket,
idempotência persistida no Java, falhas HTTP do Java, estado administrativo e
autorização de saída. UNAVAILABLE informa ausência de integração; não simula
uma falha de rede. Nenhum desses critérios foi declarado integrado ou mockado.
PR #13/OCR permanece separado.
