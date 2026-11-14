# Articuno — estado do projeto e retomada da sessão

Snapshot conferido no GitHub em **14/11/2026**, a partir das **03:02 (UTC−03,
America/Sao_Paulo)**. Prazo informado pela equipe: **14/11/2026 às 12h**.
Este documento registra evidências disponíveis, não substitui uma nova consulta
ao remoto antes de continuar o desenvolvimento.

- Repositório: [billyyfalcao/articuno](https://github.com/billyyfalcao/articuno).
- Project: [billyyfalcao #6](https://github.com/users/billyyfalcao/projects/6).
- Base conferida: `origin/develop` em `6e3deac01f96de1fbb6f420e4851142f7e484151`.
- **Novidade desta conferência:** o PR #17 do PY-08 foi integrado pela equipe
  em `2026-11-14T05:58:57Z` (02:58:57 em São Paulo). A Issue #8 continua aberta:
  os critérios dependentes de OCR real, Java e React continuam pendentes.
- Branch desta documentação: `docs/PY-08-project-status`, criada da base acima,
  para commit **somente local**, sem push ou PR. Nenhuma mudança funcional.

## 1. Arquitetura e interfaces

Fluxo pretendido: vídeo/câmera lógica → Python/FastAPI → REST interno
Java/Spring Boot → banco principal. Um único React compartilhado consulta o
estado da visão no Python e os dados administrativos no Java.

| Componente | Responsabilidade | Evidência atual |
|---|---|---|
| Python/FastAPI | MP4 local, frames, câmeras lógicas, eventos, simulação assistida, transporte HTTP; OCR experimental separado | Backend executável em `backend/parking-vision-python`; OCR não integrado |
| Java/Spring Boot | Sessões, tickets/QR, setores, ocupação estimada, recomendação, pagamento demonstrativo, janela de saída e cancela | Backend funcional não publicado nas branches inspecionadas; integração real não executada |
| React compartilhado | Interfaces administrativas, motorista e totem; monitoramento em `frontend/src/features/monitoring` | Fontes do aplicativo não publicadas; PY-07 bloqueado |

As três interfaces acordadas são:

1. **Painel administrativo — `/admin`:** dados administrativos do Java e área
   de monitoramento do Python. Preservar a autenticação do colega.
2. **Portal do motorista — `/motorista/:token` no planejamento:** o build
   existente usa **`/ticket/:token`** e subrotas. Preservar essa rota até
   coordenação explícita; não renomear silenciosamente.
3. **Totem de entrada — `/totem/entrada`:** interface prevista, sem implementação
   funcional comprovada no material publicado.

Python não cria sessões, tickets, regras de cobrança ou ocupação. O mock HTTP
é somente um receptor de testes, não uma implementação alternativa do Java.
Não há `docs/API_CONTRACT.md` publicado na base conferida. Método, rota,
autenticação, respostas e efeitos de negócio precisam de confirmação do Java.
O destino do cliente HTTP é configurável; nenhuma rota proposta é definitiva.

## 2. Issues, Project e critérios efetivamente atendidos

Estados abaixo lidos do GitHub nesta conferência. **Issue fechada ou card Done
não comprova critérios que dependem de serviços ainda indisponíveis.** Nenhum
status foi alterado durante a criação deste resumo.

| Issue | GitHub / Project | PR | Situação técnica |
|---|---|---|---|
| [#1 — PY-01](https://github.com/billyyfalcao/articuno/issues/1) | CLOSED / Done | [#10, integrado](https://github.com/billyyfalcao/articuno/pull/10) | Estrutura FastAPI, health, configuração validada, CORS e testes integrados |
| [#2 — PY-02](https://github.com/billyyfalcao/articuno/issues/2) | CLOSED / Done | [#12, integrado](https://github.com/billyyfalcao/articuno/pull/12) | MP4 local, amostragem, início/parada/estado, análise única em background integrados |
| [#3 — PY-03](https://github.com/billyyfalcao/articuno/issues/3) | OPEN / In progress | [#13, aberto](https://github.com/billyyfalcao/articuno/pull/13) | OCR experimental; nenhuma placa real completa corretamente reconhecida e comprovada; não integrar agora |
| [#4 — PY-04](https://github.com/billyyfalcao/articuno/issues/4) | CLOSED / Done | [#14, integrado](https://github.com/billyyfalcao/articuno/pull/14) | Eventos, mapa de câmeras/transições, deduplicação e idempotência locais integrados |
| [#5 — PY-05](https://github.com/billyyfalcao/articuno/issues/5) | CLOSED / Done | [#16, integrado](https://github.com/billyyfalcao/articuno/pull/16) | Cliente HTTP e falhas/retries validados com mock. **Integração Spring Boot e efeitos de negócio pendentes**, apesar do estado administrativo |
| [#6 — PY-06](https://github.com/billyyfalcao/articuno/issues/6) | CLOSED / Done | [#15, integrado](https://github.com/billyyfalcao/articuno/pull/15) | Simulador, histórico e resultados locais integrados; não representam sessões Java |
| [#7 — PY-07](https://github.com/billyyfalcao/articuno/issues/7) | OPEN / Backlog | Nenhum | Bloqueado tecnicamente por falta das fontes React; diagnóstico preservado, sem recriar frontend |
| [#8 — PY-08](https://github.com/billyyfalcao/articuno/issues/8) | OPEN / Backlog | [#17, integrado](https://github.com/billyyfalcao/articuno/pull/17) | Estabilização, testes locais/mock e documentação integrados; aceite ponta a ponta ainda parcial |
| [#9 — PY-09](https://github.com/billyyfalcao/articuno/issues/9) | OPEN / Backlog | Nenhum | P1 opcional, não iniciado; aguardar estabilidade e integração P0 |

O Project possui os estados Backlog, Ready, In progress, In review e Done.
PY-07 está bloqueado por dependência, embora seu status real seja Backlog.
PY-08 não deve ser marcado como integralmente concluído apenas pelo merge #17.
A movimentação dos cards continua manual, salvo autorização explícita.

## 3. Branches e PRs

Referências atualizadas por `git fetch origin` nesta sessão:

| Branch remota | Commit | Observação |
|---|---|---|
| `origin/develop` | `6e3deac` | Branch de integração; contém PY-01/02/04/05/06 e trabalho independente do PY-08 |
| `origin/main` | `0b7c053` | Merge anterior pelo [PR #11](https://github.com/billyyfalcao/articuno/pull/11); usuário pediu preservar, sem reversão |
| `origin/development` | `8230038` | Branch distinta de develop; build React e dependências do colega, sem fontes recuperáveis do aplicativo |
| `origin/feat/PY-01-estrutura-fastapi` | `8a992f9` | PR #10 integrado |
| `origin/feat/PY-02-processamento-video` | `a964680` | PR #12 integrado |
| `origin/feat/PY-03-ocr-placas` | `89ed134` | PR #13 aberto para develop; preservar separado |
| `origin/feat/PY-04-eventos-cameras` | `2c7d6fa` | PR #14 integrado |
| `origin/feat/PY-05-cliente-java` | `00ed519` | PR #16 integrado |
| `origin/feat/PY-06-simulador-cameras` | `31c82b0` | PR #15 integrado |
| `origin/feat/PY-08-testes-estabilizacao` | `f68fd69` | PR #17 integrado; commits `93d34b0` e `f68fd69` preservados |

Não há branch/PR PY-07 publicado nesta conferência. O único PR aberto listado
é #13. Nenhum merge foi realizado pelo agente nesta tarefa.

O checkout estava limpo em `feat/PY-08-testes-estabilizacao` antes da criação
da branch de documentação. As referências **locais** `develop` (`c953fee`) e
`main` (`e3a08d5`) estão atrasadas; não foram movidas. Para novo trabalho, usar
`origin/develop` novamente atualizado, preservando eventuais alterações locais.
Não confundir `development` com a branch de integração `develop`.

## 4. FastAPI disponível na base integrada

Rotas verificadas em `app/main.py` e `app/simulator.py`:

| Método e rota | Comportamento disponível |
|---|---|
| `GET /health` | Retorna `{"status":"ok"}`; não verifica Java ou OCR |
| `GET /api/v1/vision/status` | Estado e contadores da análise local |
| `POST /api/v1/vision/analyze/start` | Inicia MP4 por `filename`, com `sample_every` configurável; HTTP 202 |
| `POST /api/v1/vision/analyze/stop` | Solicita parada cooperativa |
| `GET /api/v1/vision/cameras` | Mapa lógico, setores e indicação explícita de simulador/ausência de hardware |
| `POST /api/v1/vision/events/simulate` | Valida e registra operação ASSISTED ou SIMULATION usando o registro PY-04 |
| `GET /api/v1/vision/events` | Histórico em memória, com `offset` e `limit` (máximo 100) |
| `GET /api/v1/vision/events/{event_id}` | Evento e resultado local/HTTP conhecido |
| `POST /api/v1/vision/events/{event_id}/send` | Envia pelo transporte configurado, mantendo event_id; não envia se desabilitado |

Swagger disponível em `/docs`. Não há upload, streaming de MP4 ou OCR ativo
nessa base. As rotas de detecções/imagem do PR #13 não estão integradas.

- Câmeras de exemplo: CAM_ENTRADA (ENTRY), CAM_A_B (PASSAGE A→B), CAM_SAIDA
  (EXIT). São configuração de demonstração, não mapeamento Java confirmado.
- `operation_id` identifica a mesma operação entre leituras/reenvios;
  reutilizá-lo preserva `event_id`. Uma passagem posterior legítima usa outro
  `operation_id`. Não há rastreamento automático de veículos entre frames.
- ENTRY assistido permite placa e sessão nulas. PASSAGE/EXIT sem placa exigem
  `session_id` conhecido; o Python não comprova a existência da sessão no Java.
- Fonte manual não recebe confiança fictícia. O enum é **SIMULATION**, não
  SIMULATED. OCR continua uma origem prevista, sem detector integrado.
- `LOCAL_VALIDATED` é validação local; `HTTP_ACKNOWLEDGED` é somente HTTP 2xx.
  Nenhum deles comprova criação de sessão/ticket. Timeout/5xx podem resultar
  em `UNCERTAIN`; não gerar novo ID para contornar uma operação incerta.
- Retry automático só é habilitado com garantia explícita de idempotência do
  receptor. URL base, caminho de envio, timeout e chave interna são configuráveis;
  a chave nunca deve ir ao frontend ou aos logs.
- Registros limitados a 1.000 operações, em memória, perdidos ao reiniciar.
  Usar um worker e loopback. CORS não é autenticação do operador.

## 5. Testes e evidências

**Reexecutados nesta sessão**, no Windows, usando o venv existente e o código
integrado em `6e3deac`:

| Comando na pasta `backend/parking-vision-python` | Resultado |
|---|---|
| `.venv/Scripts/python.exe -m pytest -q` | **96 passed, 1 warning**, 2,12 s, sem skips |
| `.venv/Scripts/python.exe -m pip check` | **No broken requirements found** |

O aviso é a depreciação do uso de HTTPX no TestClient/Starlette. A mensagem
OpenCV `moov atom not found` corresponde ao teste intencional de MP4 corrompido.
Não foi feita atualização de dependências ou alteração de código nesta tarefa.

**Evidências anteriores registradas no PR #17 e no
[BACKEND_RUNBOOK.md](../backend/parking-vision-python/BACKEND_RUNBOOK.md):**

- Dois processos locais reais: FastAPI → mock HTTP, executados por
  `tools/demo_http.py`. ENTRY/PASSAGE/EXIT com sucesso, 500 transitório,
  timeout transitório, 401, 403, 422 e 500 persistente; IDs, payloads,
  tentativas e ausência de retransmissão após sucesso conferidos.
- Fluxo assistido sem placa, rejeição de transição inválida com 422,
  deduplicação e passagem posterior legítima validados.
- Falhas de configuração, logs sanitizados e bloqueio de reenvio incerto sem
  garantia de idempotência cobertos. Corrigidos caracteres de controle no
  destino HTTP e estado terminal quando a liberação da captura falha.
- MP4 autorizado: 1.800 frames lidos e 60 amostrados (`sample_every=30`),
  estado completed e health responsivo. **Sem OCR**.
- Startup com timeout inválido rejeitado sem expor valor ou segredo de teste;
  suíte também validada com variável de idempotência do operador para conferir
  isolamento dos testes.

Esses ensaios funcionais anteriores **não foram repetidos nesta tarefa de
documentação**. Não houve teste com Spring Boot, build/smoke React ou validação
de pagamento/cancela. Instalação limpa e execução Linux não foram repetidas;
Linux está documentado, não comprovado neste ambiente.

## 6. OCR e mídia local — PR #13 preservado

O PR #13 permanece aberto em `feat/PY-03-ocr-placas`, commit `89ed134`, sem merge.
O texto bruto do OCR é separado da normalização/validação brasileira
(`ABC1234` e `ABC1D23`). Leituras inválidas ou fracas não autorizam eventos.

Diagnóstico disponível na branch OCR:
[OCR_DIAGNOSTIC.md](https://github.com/billyyfalcao/articuno/blob/89ed134/backend/parking-vision-python/OCR_DIAGNOSTIC.md).
O vídeo estrangeiro é 1920×1080, 30 fps, 1.800 frames, mas os recortes de placa
medidos têm apenas 74–94 × 22–25 pixels e desfoque. ROI fixa e amostragem a cada
300 frames também perdiam o enquadramento durante a passagem.

Foram comparados recortes, frames, escala, cinza, Otsu, CLAHE, margens e modos
Tesseract. Houve melhora parcial: no frame 150, `APOS JED` passou a `APOS JEO`,
com confiança 0,91, enquanto a transcrição visual era `AP05 JEO`. Persistiram
dois caracteres errados. **Nenhuma leitura completa correta de placa real foi
comprovada.** Confiança alta não foi tratada como prova; não houve substituição
de caracteres para forçar acerto nem mudança global de filtros sem evidência.

Testes com texto brasileiro sintético não comprovam reconhecimento de fotos
reais. Fotografias brasileiras reais autorizadas e validação real continuam
pendentes. A suíte atual de 96 testes não incorpora o OCR desse PR.

Arquivo local conferido:
`backend/parking-vision-python/videos/License_Plate_Detection_Test_1080p.mp4`
(18.457.901 bytes). O nome **não é `estacionamento.mp4`**. `git check-ignore`
confirmou a proteção; `videos/` e `*.mp4` estão ignorados. O vídeo não está no
commit e precisará ser disponibilizado localmente em outro computador.

## 7. Dependências externas bloqueadas

**Java:** não foram encontrados fontes `.java`, `pom.xml` ou `build.gradle`
do aplicativo nas branches remotas inspecionadas. Isso descreve o material
publicado, não o trabalho local do colega. Não existe evidência de backend
funcional disponível para estes testes. Confirmar contrato e testar sessão,
ticket, idempotência persistente, setores/ocupação, pagamento e saída contra
Spring Boot antes de declarar integração real ou concluir o aceite do PY-05.

**React / PY-07:** `origin/development` (`8230038`) contém **13 arquivos em
dist e 6.179 em node_modules**. Fora dessas pastas há apenas configuração de
editor e o documento original da entrega. Faltam fontes `src`, `package.json`
e configurações do aplicativo; não há projeto React recuperável com build
reproduzível. As outras branches remotas também não forneceram essas fontes.

O diagnóstico anterior do bundle identificou layouts/rotas administrativas e
do motorista (`/ticket/:token`), com páginas de conteúdo ainda “Em construção”.
Isso não comprova telas funcionais ou chamadas a APIs reais. Não foi executado
`npm run build`, smoke test ou integração React ↔ FastAPI.

Próxima ação de menor risco: o colega publicar fontes, manifesto/lockfile,
configurações e assets necessários. Reutilizar seletivamente em branch própria,
preservar autenticação e rotas, não importar `node_modules`/`dist`, não criar
segundo React e não reconstruir o frontend a partir de código minificado.

## 8. Prioridades até as 12h

Ordem sugerida para a retomada; nenhuma destas ações foi iniciada por este
commit de documentação:

1. **Preservar uma demonstração reproduzível do backend já integrado.** Seguir
   o runbook, usar Swagger para ENTRY → PASSAGE A→B → EXIT e o mock explícito
   para transporte/falhas. Mostrar resultados locais sem anunciar sessão,
   ticket, ocupação ou cancela reais.
2. **Desbloquear dependências com a equipe:** obter fontes React e contrato/
   backend Java executável. Quando disponíveis, confirmar contrato antes de
   configurar envio e validar ENTRY com sessão/ticket, duplicação, PASSAGE e
   EXIT com pagamento/janela. Não substituir essa prova pelo mock.
3. **Retomar PY-07 após as fontes:** monitoramento em um único React, usando
   os endpoints reais listados acima. Preservar autenticação e `/ticket/:token`;
   mostrar indisponibilidade de Java/OCR. Executar build e smoke real.
4. **Manter fallback assistido e limitar esforço de OCR:** validar amostra
   real mais nítida/autorizada quando disponível, registrar resultado bruto
   e validação brasileira separados. Não integrar #13 sem evidência exigida
   nem iniciar melhorias opcionais PY-09 antes do P0.
5. **Repassar a matriz PY-08 antes da entrega:** executar os testes/fluxos
   afetados pelas mudanças, registrar quais dependências chegaram a funcionar,
   revisar PRs com a equipe e apresentar limitações remanescentes. Se Java ou
   React continuarem ausentes, entregar a demo local identificada como tal;
   não declarar MVP ponta a ponta concluído.

## 9. Como continuar em outra sessão

1. Ler este arquivo e o
   [runbook do backend](../backend/parking-vision-python/BACKEND_RUNBOOK.md).
   Detalhes: [README](../backend/parking-vision-python/README.md),
   [eventos](../backend/parking-vision-python/EVENTS.md),
   [simulador](../backend/parking-vision-python/SIMULATOR.md) e
   [cliente HTTP](../backend/parking-vision-python/HTTP_CLIENT.md).
2. Executar `git status --short --branch`, `git branch --show-current` e
   `git log -3 --oneline`. Esta documentação fica em **commit local**, na
   branch `docs/PY-08-project-status`; não estará disponível em outro clone
   até publicação autorizada. `git log -1 -- docs/PROJECT_STATUS.md` identifica
   o commit do resumo.
3. Fazer `git fetch origin` e conferir novamente Issues, PRs e Project. Exemplo:

   ```powershell
   gh pr list --repo billyyfalcao/articuno --state all
   gh issue list --repo billyyfalcao/articuno --state all
   gh project item-list 6 --owner billyyfalcao --limit 100 --format json
   ```

   Nesta máquina, quando `gh` não está no PATH, usar
   `& 'C:/Program Files/GitHub CLI/gh.exe'` no lugar de `gh`.
4. Para execução local, na pasta do serviço:

   ```powershell
   .venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
   ```

   O venv e `.env` são locais e ignorados. Para ambiente novo, seguir instalação
   do runbook; não sobrescrever `.env` existente nem imprimir seus segredos.
5. Preservar o PDF original em `docs/`, o PR #13, a branch `development` e
   trabalho alheio. Criar branches de trabalho a partir de `origin/develop`
   atualizado; não commitar diretamente em main/develop, não forçar push e
   não fazer merge automático. A tarefa atual termina com o resumo salvo:
   não iniciar outra implementação como efeito desta documentação.
