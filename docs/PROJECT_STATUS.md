# Articuno — estado do projeto e retomada

Conferido no GitHub em **14/11/2026**, durante a entrega do JV-02. Prazo da equipe:
**14/11/2026 às 12h**. Consultar novamente o remoto antes de continuar.

- Repositório: [billyyfalcao/articuno](https://github.com/billyyfalcao/articuno).
- Project: [billyyfalcao #6](https://github.com/users/billyyfalcao/projects/6).
- Base: `origin/develop` em `885b354363a50ee710a5ce5aa97aeb1ce5dd911b`.
- **JV-01 já integrado:** [PR #26](https://github.com/billyyfalcao/articuno/pull/26),
  merge em 14/11 às 04:16:05 de Brasília. Não repetir a estrutura Java.
- Branch atual: `feat/JV-02-eventos-idempotencia`, baseada nesse develop.
  Receptor JV-02 implementado, testado e publicado no
  [PR #27](https://github.com/billyyfalcao/articuno/pull/27), OPEN para develop.
  Card em In review; aguarda revisão/merge pela equipe, sem auto-merge.
- O resumo anterior, publicado pelo [PR #18](https://github.com/billyyfalcao/articuno/pull/18),
  dizia que Java estava ausente e que este documento era apenas local. Essas
  informações estão desatualizadas e foram corrigidas aqui.

## 1. Arquitetura e interfaces

Vídeo/câmera lógica → Python/FastAPI → REST interno Java/Spring Boot → SQLite.
Um único React compartilhado deverá consumir os dois backends.

| Componente | Responsabilidade e estado |
|---|---|
| Python | MP4, frames, câmeras lógicas, eventos, simulador assistido e cliente HTTP integrados; OCR continua separado no PR #13 |
| Java | Fonte de verdade futura das sessões, setores, ocupação estimada, tickets e pagamentos; estrutura/SQLite/health integrados; receptor persistente JV-02 validado nesta branch |
| React | Painel administrativo, portal do motorista e totem; fontes completas ainda não publicadas |

Interfaces acordadas: **/admin**, portal do motorista e **/totem/entrada**.
O planejamento usa /motorista/:token, mas o bundle do colega usa **/ticket/:token**:
preservar essa rota e a autenticação administrativa. Totem e monitoramento
funcionais não foram comprovados. Não criar outro React.

Python não acessa o banco Java nem implementa regras de sessões/pagamento.
O mock HTTP permanece como ferramenta de teste. O JV-02 agora tem contrato
implementado em [API_CONTRACT.md](API_CONTRACT.md), limitado ao **registro de
eventos**; não comprova sessões, ocupação, pagamento ou cancela.

## 2. Issues e Project

Estados consultados no GitHub. Done/Issue fechada não comprova automaticamente
dependências externas. Apenas JV-02 foi movido para In progress e depois
In review nesta execução; demais cards preservados.

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
| [#20 JV-02](https://github.com/billyyfalcao/articuno/issues/20) | OPEN / In review | PR #27 aberto; receptor autenticado, persistência e idempotência testados |
| [#21 JV-03](https://github.com/billyyfalcao/articuno/issues/21) | OPEN / Backlog | Sessões, setores, capacidade/ocupação estimada e transições de negócio pendentes |
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
| origin/develop | 885b354 | Integra PY-01/02/04/05/06, trabalho independente PY-08, documento #18 e JV-01 #26 |
| origin/main | 0b7c053 | Merge anterior preservado conforme pedido da equipe |
| origin/development | 8230038 | Build/dependências React, sem fontes recuperáveis; não é base de integração |
| origin/docs/PY-08-project-status | 8799b26 | PR #18 integrado |
| origin/feat/JV-01-estrutura-springboot | c80ab6d | PR #26 integrado |
| origin/feat/JV-02-eventos-idempotencia | Consultar head do PR #27 | Branch publicada; receptor e documentação em revisão |
| origin/feat/PY-03-ocr-placas | 89ed134 | PR #13 OPEN, base develop; nenhuma alteração nesta execução |
| origin/feat/PY-08-testes-estabilizacao | f68fd69 | PR #17 integrado |
| origin/feat/PY-01-estrutura-fastapi | 8a992f9 | PR #10 integrado |
| origin/feat/PY-02-processamento-video | a964680 | PR #12 integrado |
| origin/feat/PY-04-eventos-cameras | 2c7d6fa | PR #14 integrado |
| origin/feat/PY-05-cliente-java | 00ed519 | PR #16 integrado |
| origin/feat/PY-06-simulador-cameras | 31c82b0 | PR #15 integrado |

O checkout estava limpo antes da criação da branch JV-02. As branches locais
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

Java integrado JV-01: GET /health. **Nesta branch JV-02:**

| Método / rota | Função |
|---|---|
| POST /api/v1/internal/vision-events | Valida e persiste evento/recibo no SQLite; 200 RECORDED |
| GET /api/v1/internal/vision-events/{event_id} | Consulta evento e recibo persistidos |

As rotas internas exigem X-Internal-API-Key; chave ausente no servidor desabilita
o receptor com 503, sem derrubar health. Replay idêntico retorna recibo original;
mesmo ID com outro conteúdo retorna 409. A PK do SQLite controla concorrência.
Schema 1→2 migra em transação; fazer backup antes da atualização e não executar
binário JV-01 sobre schema 2. Registros JV-02 não representam sessões nem serão
automaticamente interpretados como efeitos de negócio retroativos.

Configurar URL base, endpoint e chave no Python conforme
[contrato](API_CONTRACT.md). JAVA_IDEMPOTENCY_CONFIRMED=true é suportado por este
receptor. A chave permanece nos servidores. O cliente Python atual descarta
o corpo da resposta; consultar o GET interno para conferir o recibo.

## 5. Evidências executadas no JV-02

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
Demo reproduzível: tools/demo_vision_events.py dentro do serviço Java.
O ensaio inicia o JAR e usa diretamente EventRegistry/JavaClient existentes;
**não inicia servidor FastAPI nem React e não comprova o ciclo do JV-04**.
Nenhum arquivo funcional Python/React foi alterado.

Evidências anteriores do PY-08 permanecem em
[BACKEND_RUNBOOK.md](../backend/parking-vision-python/BACKEND_RUNBOOK.md):
FastAPI → mock em dois processos, erros 401/403/422/500/timeout, fluxo assistido,
deduplicação e vídeo com 1.800 frames/60 amostras e health responsivo.
Esses ensaios anteriores não foram repetidos integralmente no JV-02.
Linux/instalação limpa, build React, sessões, pagamento e cancela não validados.

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

Java **já existe**, mas sessões, setores e regras de saída ainda não.
Nenhum EXIT recebido pelo JV-02 autoriza cancela ou encerra sessão.
Link público é apenas planejamento no README Java: nenhum deploy/túnel criado,
nem autorização para implementar infraestrutura nesta etapa.

## 8. Prioridades até as 12h e retomada

1. Revisar/autorizar merge do JV-02. Aguardar equipe; não fazer merge automático.
2. Após merge, JV-03 a partir de develop atualizado: sessões, setores e
   ocupação estimada; definir comportamento da entrada sem placa e transições.
3. JV-04: FastAPI → Java reais, consultar estado de negócio, duplicação e falhas.
   Não anunciar saída autorizada enquanto as regras de saída estiverem pendentes.
4. JV-05/JV-06: ticket/token/QR e pagamento demonstrativo/saída, com regras
   confirmadas no documento da equipe. Consolidar testes JV-07/PY-08.
5. Retomar PY-07 quando fontes chegarem. Manter fallback assistido; não depender
   de OCR nem iniciar PY-09. Demonstração local vem antes da publicação.
6. Antes da apresentação, registrar exatamente quais cenários funcionam.

Para outra sessão: ler este arquivo, contrato e README/guia JV-02 Java, além de
EVENTS.md, SIMULATOR.md, HTTP_CLIENT.md e BACKEND_RUNBOOK.md do Python.
Conferir git status/branch/log e git fetch origin, PRs/Issues/Project.
Nesta máquina gh pode exigir caminho completo:
`C:/Program Files/GitHub CLI/gh.exe`.

Instruções Windows para os serviços estão nos READMEs; Java seleciona JDK 21
por terminal, Python usa venv e Uvicorn. React permanece bloqueado.
Preservar PDF original em docs/, PR #13, development e alterações alheias.
Não commitar .env, .venv, bancos, vídeos ou segredos; não forçar push, não
commitar em main/develop e não iniciar outro card sem autorização.
