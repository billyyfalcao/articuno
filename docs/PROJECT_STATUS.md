# Articuno — estado do projeto e retomada

Conferido no GitHub em **14/11/2026**, durante a entrega do JV-03. Prazo da equipe:
**14/11/2026 às 12h**. Consultar novamente o remoto antes de continuar.

- Repositório: [billyyfalcao/articuno](https://github.com/billyyfalcao/articuno).
- Project: [billyyfalcao #6](https://github.com/users/billyyfalcao/projects/6).
- Base: `origin/develop` em `e99c3b177bec7b5b96bf1e089a936973eac7ecba`.
- **JV-01 já integrado:** [PR #26](https://github.com/billyyfalcao/articuno/pull/26),
  merge em 14/11 às 04:16:05 de Brasília. Não repetir a estrutura Java.
- **JV-02 integrado:** [PR #27](https://github.com/billyyfalcao/articuno/pull/27),
  merge em 14/11 às 08:46:23 de Brasília. Issue #20 ainda OPEN / In review no
  Project na consulta; esse estado administrativo foi preservado.
- Branch atual: `feat/JV-03-sessoes-setores`, baseada nesse develop. Sessões,
  setores e consultas implementados/testados; [PR #28](https://github.com/billyyfalcao/articuno/pull/28)
  OPEN para develop, sem auto-merge. JV-03 em In review. EXIT autorizado segue
  bloqueado pelo JV-06; Issue #21 permanece aberta, sem marcar Done.
- O resumo anterior, publicado pelo [PR #18](https://github.com/billyyfalcao/articuno/pull/18),
  dizia que Java estava ausente e que este documento era apenas local. Essas
  informações estão desatualizadas e foram corrigidas aqui.

## 1. Arquitetura e interfaces

Vídeo/câmera lógica → Python/FastAPI → REST interno Java/Spring Boot → SQLite.
Um único React compartilhado deverá consumir os dois backends.

| Componente | Responsabilidade e estado |
|---|---|
| Python | MP4, frames, câmeras lógicas, eventos, simulador assistido e cliente HTTP integrados; OCR continua separado no PR #13 |
| Java | Estrutura/SQLite/health e receptor JV-02 integrados; sessões/setores/ocupação estimada implementados nesta branch JV-03; tickets, pagamentos e saída autorizada pendentes |
| React | Painel administrativo, portal do motorista e totem; fontes completas ainda não publicadas |

Interfaces acordadas: **/admin**, portal do motorista e **/totem/entrada**.
O planejamento usa /motorista/:token, mas o bundle do colega usa **/ticket/:token**:
preservar essa rota e a autenticação administrativa. Totem e monitoramento
funcionais não foram comprovados. Não criar outro React.

Python não acessa o banco Java nem implementa regras de sessões/pagamento.
O mock HTTP permanece como ferramenta de teste. O JV-02 agora tem contrato
implementado em [API_CONTRACT.md](API_CONTRACT.md), evoluído nesta branch para
sessões e ocupação estimada. Não comprova pagamento, ticket ou cancela autorizada.

## 2. Issues e Project

Estados consultados no GitHub. Done/Issue fechada não comprova automaticamente
dependências externas. Apenas JV-03 foi movido para In progress e In review;
demais cards preservados, inclusive JV-02 ainda em In review após o merge.

| Issue | Estado GitHub / Project | Situação |
|---|---|---|
| [#1 PY-01](https://github.com/billyyfalcao/articuno/issues/1) | CLOSED / Done | Integrado, PR #10: FastAPI, health, configuração, CORS |
| [#2 PY-02](https://github.com/billyyfalcao/articuno/issues/2) | CLOSED / Done | Integrado, PR #12: MP4, amostragem e processamento em background |
| [#3 PY-03](https://github.com/billyyfalcao/articuno/issues/3) | OPEN / In progress | PR #13 aberto; leitura real completa não validada; não integrar |
| [#4 PY-04](https://github.com/billyyfalcao/articuno/issues/4) | CLOSED / Done | Integrado, PR #14: eventos, câmeras, deduplicação local |
| [#5 PY-05](https://github.com/billyyfalcao/articuno/issues/5) | CLOSED / Done | Integrado, PR #16: cliente HTTP; transporte ao receptor real validado no JV-02, efeitos de negócio pendentes |
| [#6 PY-06](https://github.com/billyyfalcao/articuno/issues/6) | CLOSED / Done | Integrado, PR #15: simulador e histórico local |
| [#7 PY-07](https://github.com/billyyfalcao/articuno/issues/7) | OPEN / Backlog | Bloqueado pelas fontes React; sem PR |
| [#8 PY-08](https://github.com/billyyfalcao/articuno/issues/8) | OPEN / Backlog | PR #17 integrado; aceite ponta a ponta com OCR/Java/React permanece parcial |
| [#9 PY-09](https://github.com/billyyfalcao/articuno/issues/9) | OPEN / Backlog | P1 opcional, não iniciado |
| [#19 JV-01](https://github.com/billyyfalcao/articuno/issues/19) | CLOSED / Done | PR #26 integrado: Java 21, Spring Boot, SQLite, health |
| [#20 JV-02](https://github.com/billyyfalcao/articuno/issues/20) | OPEN / In review | PR #27 integrado; estado administrativo ainda não atualizado pela equipe |
| [#21 JV-03](https://github.com/billyyfalcao/articuno/issues/21) | OPEN / In review | PR #28 aberto; sessões/setores/estimativas testados; EXIT autorizado bloqueado por JV-06 |
| [#22 JV-04](https://github.com/billyyfalcao/articuno/issues/22) | OPEN / Backlog | Ciclo de negócio completo Python ↔ Java pendente |
| [#23 JV-05](https://github.com/billyyfalcao/articuno/issues/23) | OPEN / Backlog | Ticket/token/QR e consulta do motorista pendentes |
| [#24 JV-06](https://github.com/billyyfalcao/articuno/issues/24) | OPEN / Backlog | Pagamento demonstrativo e autorização de saída pendentes |
| [#25 JV-07](https://github.com/billyyfalcao/articuno/issues/25) | OPEN / Backlog | Consolidação final; testes incrementais executados nos cards |

Project: Backlog, Ready, In progress, In review e Done. Não existe status
Blocked; PY-07 está tecnicamente bloqueado em Backlog. Novas mudanças de status
seguem as autorizações específicas da equipe, sem movimentar outros cards.

## 3. Branches e PRs

`git fetch origin` confirmou ausência de nova publicação do colega no Java/React.

| Branch remota | Commit | Observação |
|---|---|---|
| origin/develop | e99c3b1 | Integra PY-01/02/04/05/06, trabalho independente PY-08, documento #18 e JV-01/JV-02 |
| origin/main | 0b7c053 | Merge anterior preservado conforme pedido da equipe |
| origin/development | 8230038 | Build/dependências React, sem fontes recuperáveis; não é base de integração |
| origin/docs/PY-08-project-status | 8799b26 | PR #18 integrado |
| origin/feat/JV-01-estrutura-springboot | c80ab6d | PR #26 integrado |
| origin/feat/JV-02-eventos-idempotencia | dbdb821 | PR #27 integrado |
| origin/feat/JV-03-sessoes-setores | Consultar head do PR #28 | Branch publicada, em revisão |
| origin/feat/PY-03-ocr-placas | 89ed134 | PR #13 OPEN, base develop; nenhuma alteração nesta execução |
| origin/feat/PY-08-testes-estabilizacao | f68fd69 | PR #17 integrado |
| origin/feat/PY-01-estrutura-fastapi | 8a992f9 | PR #10 integrado |
| origin/feat/PY-02-processamento-video | a964680 | PR #12 integrado |
| origin/feat/PY-04-eventos-cameras | 2c7d6fa | PR #14 integrado |
| origin/feat/PY-05-cliente-java | 00ed519 | PR #16 integrado |
| origin/feat/PY-06-simulador-cameras | 31c82b0 | PR #15 integrado |

O checkout estava limpo antes da criação da branch JV-03. As branches locais
develop (c953fee) e main (e3a08d5) continuam preservadas e atrasadas. Trabalhos
novos devem partir de origin/develop atualizado; nenhum merge automático.

## 4. Endpoints e limites atuais

FastAPI integrado, conferido em app/main.py e app/simulator.py:

| Método / rota | Função |
|---|---|
| GET /health | Saúde local, sem verificar Java/OCR |
| GET /api/v1/vision/status | Estado/contadores do vídeo |
| POST /api/v1/vision/analyze/start | Iniciar por filename e sample_every; 202 |
| POST /api/v1/vision/analyze/stop | Parada cooperativa |
| GET /api/v1/vision/cameras | Mapa lógico e setores de demonstração |
| POST /api/v1/vision/events/simulate | ASSISTED/SIMULATION pelo pipeline PY-04 |
| GET /api/v1/vision/events | Histórico local; offset/limit até 100 |
| GET /api/v1/vision/events/{event_id} | Evento e resultado local/HTTP |
| POST /api/v1/vision/events/{event_id}/send | Transporte HTTP configurado, mesmo event_id |

Swagger: /docs. Não há upload/streaming MP4 nem OCR ativo nesta base.
Câmeras de exemplo: CAM_ENTRADA, CAM_A_B (A→B), CAM_SAIDA. Uma nova passagem
usa outro operation_id; retry da mesma operação preserva event_id. Entrada
assistida aceita ausência de placa/sessão; PASSAGE/EXIT sem placa precisam de
session_id. Fonte manual não recebe confiança fictícia. Enum: SIMULATION.

Histórico Python é em memória, limitado a 1.000 operações. Usar um worker e
loopback. LOCAL_VALIDATED é validação local; HTTP_ACKNOWLEDGED é transporte 2xx.
Timeout/5xx podem deixar UNCERTAIN; não gerar outro ID para contornar incerteza.

Java integrado: GET /health e receptor JV-02. **Nesta branch JV-03:**

| Método / rota | Função |
|---|---|
| POST /api/v1/internal/vision-events | Aplica ENTRY/PASSAGE e persiste evento/recibo/sessão; saída negada |
| GET /api/v1/internal/vision-events/{event_id} | Consulta evento, recibo persistido e http_status original |
| GET /api/v1/internal/sessions | Lista paginada (limit 1..100, offset >= 0) |
| GET /api/v1/internal/sessions/{session_id} | Sessão persistida e setor estimado |
| GET /api/v1/internal/sectors | Capacidades e ocupação/disponibilidade estimadas |
| GET /api/v1/internal/dashboard | Indicadores reais e exit_policy BLOCKED_PENDING_JV06 |

As rotas internas exigem X-Internal-API-Key; chave ausente no servidor desabilita
o receptor com 503, sem derrubar health. Replay idêntico retorna recibo original;
mesmo ID com outro conteúdo retorna 409. A PK e a transação IMMEDIATE do SQLite
controlam concorrência e capacidade. Schema 1/2→3 migra em transação; fazer
backup antes da atualização e não executar binários antigos sobre schema 3.
Recibos legados JV-02 permanecem RECORDED, sem criar sessões retroativas.
Novos recibos são APPLIED ou REJECTED; rejeições de negócio também preservam
HTTP/resultado nos reenvios. Ocupação vem das sessões ativas, sem contador separado.

Configurar URL base, endpoint e chave no Python conforme
[contrato](API_CONTRACT.md). JAVA_IDEMPOTENCY_CONFIRMED=true é suportado por este
receptor. A chave permanece nos servidores. O cliente Python atual descarta
o corpo da resposta; consultar o GET interno para conferir o recibo.

## 5. Evidências executadas no JV-03

- Java clean verify: **71 testes**, zero falhas/erros/skips, BUILD SUCCESS e JAR.
- Python pytest: **96 passed, 1 warning** preexistente; pip check sem conflitos.
- **FastAPI e Spring Boot reais, em dois processos:** ENTRY criou sessão em A;
  PASSAGE moveu a mesma sessão para B; estimativas consultadas pelas APIs Java.
- Entrada ASSISTED sem placa recebeu session_id real; passagem por esse ID sem
  inventar placa. Reenvios/duplicações conservaram sessões e recibos.
- EXIT retornou Java403/Python FAILED e conservou sessão ACTIVE. Não houve
  encerramento autorizado, pagamento, ticket ou abertura de cancela.
- Transição impossível/conflito retornaram 409; autenticação ausente401;
  destino lotado409 com ocupação preservada.
- Java parado gerou UNCERTAIN/timeout após 3 tentativas no FastAPI. Reinício
  preservou sessões/recibos e recuperou a entrada incerta usando o mesmo ID.
- Testes Java com duas instâncias: última vaga e destino lotado não excederam
  capacidade; falha SQL após mudar sessão reverteu também evento/recibo.

Guia/limites e critérios individuais:
[JV03_SESSIONS.md](../backend/parking-core-java/JV03_SESSIONS.md).
Demo atual: tools/demo_vision_events.py dentro do serviço Java, executada com
venv Python e JAVA_HOME=21. Usa dados ASSISTED e banco/layout/chave temporários;
não altera fontes Python ou React. Revisão independente concluída sem achados
críticos, importantes ou menores; smoke adicional com duas JVMs validou disputa
pela última vaga e replay estável após mudança de contexto e reinício.

### Histórico JV-02 (antes das regras de sessão)

Ambiente Windows; JDK Microsoft **21.0.7** em C:/Users/USER/.jdks/ms-21.0.7.
O Java do PATH continua **17**; Maven e JAR foram executados com JAVA_HOME=21.
pom.xml usa release 21. O JAR requer Java 21; não funciona no Java 17.

| Verificação | Resultado |
|---|---|
| Maven Wrapper clean verify, com cache local e modo offline | BUILD SUCCESS; **52 testes**, 0 falhas/erros/skips, JAR gerado |
| Python pytest -q, venv existente | **96 passed, 1 warning** preexistente HTTPX/TestClient |
| Python pip check | No broken requirements found |
| Produtor/cliente Python originais → JAR Spring Boot real | ENTRY/PASSAGE/EXIT 200, consultas/replays, entrada sem placa, conflito409, inválido422, autenticação401 |
| Java parado e reiniciado no mesmo banco | UNCERTAIN/timeout após 3 tentativas; depois recibos/IDs originais preservados |
| Testes HTTP Java com 2 instâncias / 12 requisições concorrentes | Um único registro e respostas idênticas |
| Revisão independente e regressões corrigidas | Chave literal com caracteres de placeholder, expoente numérico extremo, offsets Python acima de 18h |

Comandos, fixture real do modelo Python, evidências e limites:
[JV02_RECEIVER.md](../backend/parking-core-java/JV02_RECEIVER.md).
Na versão JV-02, o ensaio iniciava o JAR e usava diretamente EventRegistry/JavaClient;
não iniciava FastAPI/React. O script atual foi adaptado para a demo JV-03 acima.
Nenhum arquivo funcional Python/React foi alterado.

Evidências anteriores do PY-08 permanecem em
[BACKEND_RUNBOOK.md](../backend/parking-vision-python/BACKEND_RUNBOOK.md):
FastAPI → mock em dois processos, erros 401/403/422/500/timeout, fluxo assistido,
deduplicação e vídeo com 1.800 frames/60 amostras e health responsivo.
Esses ensaios anteriores não foram repetidos integralmente no JV-02.
Linux/instalação limpa, build React, pagamento e cancela continuam não validados.
Sessões passaram a ser comprovadas no JV-03, conforme evidências acima.

## 6. OCR e vídeo — PR #13 preservado

PR #13 continua OPEN, commit 89ed134. Não integrar sem validação real.
Texto bruto e validação brasileira permanecem separados. Nenhuma placa real
completa foi corretamente reconhecida e comprovada. No diagnóstico anterior,
o vídeo tinha 1920×1080/30fps, mas placas de apenas 74–94 × 22–25 pixels com
desfoque. Pré-processamento melhorou parcialmente APOS JED para APOS JEO,
confiança 0,91, diante de transcrição visual AP05 JEO: ainda dois erros.
Confiança alta e testes sintéticos não comprovam OCR real; fotos brasileiras
autorizadas e validação real continuam pendentes.

[Diagnóstico OCR na branch preservada](https://github.com/billyyfalcao/articuno/blob/89ed134/backend/parking-vision-python/OCR_DIAGNOSTIC.md).

Arquivo local: backend/parking-vision-python/videos/License_Plate_Detection_Test_1080p.mp4
(18.457.901 bytes). **estacionamento.mp4 não existe neste checkout.**
Vídeos/imagens locais permanecem ignorados e não entram em commits.

## 7. React e demais pendências

origin/development (8230038) mantém 13 arquivos em dist e 6.179 em node_modules;
faltam src, package.json e configurações do aplicativo recuperáveis.
O build do colega sugere rotas administrativas e /ticket/:token, com telas
“Em construção”; não comprova funcionamento real nem consumo de APIs.
Não houve npm build/smoke ou integração React ↔ FastAPI.

Menor risco: colega publicar fontes, manifesto/lockfile, configs e assets;
reutilizar seletivamente em branch PY-07, preservar autenticação/rotas,
sem importar dist/node_modules ou criar segundo React.

Java **já existe**; sessões e setores estão implementados nesta branch JV-03.
Regras de autorização de saída ainda não: EXIT é rejeitado e não encerra sessão.
Link público é apenas planejamento no README Java: nenhum deploy/túnel criado,
nem autorização para implementar infraestrutura nesta etapa.

## 8. Prioridades até as 12h e retomada

1. Revisar JV-03 e autorizar merge; saída positiva está explicitamente bloqueada.
   Aguardar equipe; não fazer merge automático nem marcar Issue21 como Done.
2. JV-04 a partir de develop atualizado: consolidar configuração e roteiro real
   usando as evidências JV-03. Ciclo completo ainda depende de autorização de saída.
3. JV-05/JV-06: ticket/token/QR e pagamento demonstrativo/saída, com regras
   confirmadas no documento da equipe. Consolidar testes JV-07/PY-08.
4. Retomar PY-07 quando fontes chegarem. Manter fallback assistido; não depender
   de OCR nem iniciar PY-09. Demonstração local vem antes da publicação.
5. Antes da apresentação, registrar exatamente quais cenários funcionam.

Para outra sessão: ler este arquivo, contrato e README/guia JV-03 Java, além de
EVENTS.md, SIMULATOR.md, HTTP_CLIENT.md e BACKEND_RUNBOOK.md do Python.
Conferir git status/branch/log e git fetch origin, PRs/Issues/Project.
Nesta máquina gh pode exigir caminho completo:
`C:/Program Files/GitHub CLI/gh.exe`.

Instruções Windows para os serviços estão nos READMEs; Java seleciona JDK 21
por terminal, Python usa venv e Uvicorn. React permanece bloqueado.
Preservar PDF original em docs/, PR #13, development e alterações alheias.
Não commitar .env, .venv, bancos, vídeos ou segredos; não forçar push, não
commitar em main/develop e não iniciar outro card sem autorização.
