# Validação da integração final — 14/11/2026

Ambiente executado: Windows, Microsoft JDK 21.0.7, Node 24.17.0/npm 11.13.0,
Python do ambiente virtual existente e Edge real controlado por Playwright.
Base conferida após `git fetch origin`: `origin/develop` em `f925e876`, merge
do PR #28 (JV-03). Branch: `feat/MVP-integracao-final`. PR #13 de OCR preservado.

## Resultado dos comandos

| Comando / verificação | Resultado observado |
|---|---|
| Java `mvnw.cmd -o -B -ntp -Dmaven.repo.local=.cache/repository clean verify`, JAVA_HOME=21 e cache Maven local | BUILD SUCCESS; 71 testes, 0 falhas/erros/skips; JAR gerado |
| Python `.venv/Scripts/python.exe -m pytest -q` | 96 passed; 1 aviso preexistente de depreciação HTTPX/TestClient |
| Python `.venv/Scripts/python.exe -m pip check` | No broken requirements found |
| Frontend `npm test` | 2 testes de gateway passaram: autenticação, roteamento, segredo, origem, limite de corpo e indisponibilidade |
| Frontend `npm run build` | Vite 8.3.8: build concluído; JS ~254 kB e CSS ~23 kB, antes de gzip |
| Frontend `npm run test:e2e` | 2 testes no Edge passaram, ~1,2 minuto; três serviços reais simultâneos |
| `node scripts/demo.mjs start` | Java8080/Python8000/frontend5173 saudáveis, somente loopback |
| Parada/reinício controlado do Java pelo launcher | Processo próprio encerrado, SQLite preservado, APIs e UI recuperadas |
| `node frontend/tests/public-smoke.mjs` (ou executado dentro de frontend) | HTTPS Cloudflare testado com Edge nesta máquina; autenticação e APIs reais verificadas |

O diagnóstico de arquivo MP4 corrompido aparece como `moov atom not found` nos
testes Python: corresponde à fixture de erro, não à falha da suíte.
Não houve instalação global de dependências ou alteração funcional dos backends.

## Cenários executados no navegador com serviços reais

| Cenário | Evidência / resultado |
|---|---|
| Painel e setores reais | Capacidade e setores A/B lidos do Java; estado vazio inicial observado |
| ENTRY assistido | Evento Python `f04f1248-796b-49fb-a056-0b5e1150a19d`; recibo Java APPLIED |
| Sessão persistida | `863a9f93-5869-4bd0-b1b6-9accd7b4e836`, criada em A, mesma sessão transferida para B |
| PASSAGE A→B | Evento `9105da5e-583b-4f30-bec1-3aa68d0f5e09`, recibo APPLIED/sector_id B |
| Atualização automática | Painel e totem em abas separadas refletiram os novos valores sem reload; polling 2,5 s |
| Dois veículos no mesmo formulário | Após ENTRY de outro veículo, passagem por placa não reutilizou session_id incompatível |
| Reenvio | Mesmo evento; quantidade de sessões e ocupação permaneceram iguais |
| Java indisponível | JVM realmente parada: gateway502, aviso visível e valores indisponíveis em vez de zeros fictícios; Python continuou200 |
| Recuperação e persistência | Reinício da JVM no mesmo SQLite conservou sessões e recuperou painel/totem |
| MP4 | Prévia local reproduziu no Edge; FastAPI leu 1.800 frames e amostrou60 com sample_every30 |
| Parada de vídeo | Botão iniciou nova análise e a parou; estado final stopped e health200 |
| Entrada sem placa | Evento `b29ab606-b802-44dc-9fd2-769f85907877`; sessão real `8d8945ba-65da-4910-a086-e03e1b21c707` |
| Passagem sem placa | Usou o session_id retornado; Java aceitou e atualizou para B |
| Consulta sem efeito | “Ver resultado” consultou evento existente sem chamada de envio |
| Rejeição de negócio | PASSAGE de veículo sem sessão ativa exibiu Rejeitado/falha; contagem preservada |
| EXIT sem autorização | Evento enviado pela API Python retornou Java403; sessão continuou ativa. Botão da UI bloqueado |
| Modo contingência | Seleção explícita, banner DADOS SIMULADOS e ações desabilitadas |
| Responsividade | Três rotas em viewport390×844 sem transbordamento da página; tabelas com rolagem própria |
| Segredo entre serviços | Chave interna ausente nos pedidos do navegador; gateway acrescenta-a somente no Java |

O ensaio principal começou com 3 sessões de execuções anteriores e terminou
com5; o ensaio sem placa acrescentou outra. Dados de teste permanecem no SQLite
local. Nenhuma sessão foi encerrada artificialmente para limpar a demonstração.
Capturas desktop/mobile foram inspecionadas e ficam em `.demo/screenshots/`,
ignoradas pelo Git. MP4 e capturas privadas não são publicados no PR.

Uma execução inicial parou porque o teste esperava uma mensagem de erro diferente
da UI. O tratamento foi melhorado para mensagem em português; a execução final
passou. Revisão independente também encontrou e corrigiu associação indevida de
session_id ao trocar a placa e listener WebSocket independente do Vite dev;
o WebSocket de desenvolvimento foi desabilitado.

## HTTPS temporário

URL criada: **https://inquiries-factory-near-tuition.trycloudflare.com**.
É efêmera, depende desta máquina ligada e exige credenciais privadas locais;
não é URL de produção ou de acesso anônimo.

Teste em 14/11 às 10:40 de Brasília, via Edge desta máquina, passando pela URL pública:

- Sem autenticação: painel e setores retornaram401.
- Com autenticação: telas e setores reais retornaram200; dois setores lidos.
- Escrita de outra origem:403; reenvio idempotente da origem HTTPS correta:200.
- Nenhuma requisição do navegador público tentou acessar localhost/127.0.0.1.
- Gateway encaminha somente rotas permitidas e não expõe as portas dos backends.

**Outro dispositivo/rede: confirmação solicitada ao usuário e ainda não recebida
ao registrar este relatório.** O teste acima não substitui essa verificação.
Não apresentar o link como validado em celular externo até obter a confirmação.
Comandos para túnel/inicialização/desligamento: [README_DEMO.md](../README_DEMO.md).

## Pendências que não estão concluídas

- OCR real: PR #13 continua aberto, sem placa completa validada; nenhuma detecção
  fabricada ou evento OCR automático na interface entregue.
- Saída autorizada, pagamento demonstrativo, ticket/QR e portal do motorista:
  dependem de JV-05/JV-06 e não fazem parte do fluxo demonstrado.
- JV-04 não está integralmente concluído: EXIT permitido/encerramento segue bloqueado.
- Instalação limpa em outra máquina/Linux e teste físico em outro dispositivo
  não foram executados por este ensaio.
- Autenticação HTTP de demonstração não substitui gestão de usuários/produção.
  A senha dá acesso administrativo; distribuir somente a avaliadores autorizados.
- Fontes React originais do colega ainda não foram publicadas em development;
  preservadas. Reutilização autorizada foi do novo protótipo fornecido.
- Project mantém os estados anteriores; nenhum card foi marcado Done nesta etapa.
