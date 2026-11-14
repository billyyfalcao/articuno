# PY-08 — execução, demonstração e estabilização do backend

## Estado e limites

Base revisada: `origin/develop` em `5462d18`, com PY-01, PY-02, PY-04, PY-05 e
PY-06 integrados. Este trabalho não incorpora o OCR do PR #13 e não altera
React ou Java. PY-07 continua bloqueado por falta das fontes React; não há
build frontend executável nesta branch. A Issue PY-08 permanece parcial até
as integrações reais poderem ser testadas.

Funcional hoje: API local, leitura de MP4, eventos/câmeras, simulação assistida,
histórico em memória e transporte HTTP configurável. A demonstração do receptor
é **FastAPI → mock HTTP**, não Spring Boot. Health 200 indica apenas processo
respondendo; `HTTP_ACKNOWLEDGED` indica apenas resposta HTTP 2xx.

## Instalação

Requisitos: Python 3.13, suporte a venv e acesso ao PyPI. A validação registrada
abaixo foi executada em Windows com Python 3.13.7; os comandos Linux estão
documentados, mas não foram executados neste ambiente.

Windows PowerShell, a partir da raiz do repositório:

```powershell
cd backend/parking-vision-python
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
.venv/Scripts/python.exe -m pip check
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Linux:

```bash
cd backend/parking-vision-python
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
test -f .env || cp .env.example .env
.venv/bin/python -m pip check
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Não sobrescreva um `.env` existente. Sem `.env`, os padrões permitem execução
local sem transporte. `.env.example` deixa destino e chave HTTP desativados.
Configuração do processo prevalece sobre o arquivo. Para instalação sem testes,
use `requirements.txt`. Não são necessários Tesseract, frontend ou Java para
esta branch integrada. Não utilize vários workers: registros e análise única
são locais a cada processo. Encerre o serviço com Ctrl+C.

## Demonstração pelo Swagger

Abra `http://127.0.0.1:8000/docs` e use Try it out. Confira `/health`, consulte
as câmeras e siga os corpos completos em [SIMULATOR.md](SIMULATOR.md):

1. Crie ENTRY com `operation_id=demo-entry-1`, CAM_ENTRADA e placa de teste
   explicitamente simulada. Verifique LOCAL_VALIDATED/NOT_SENT.
2. Repita a mesma operação. event_id, timestamp e histórico são preservados.
3. Crie PASSAGE CAM_A_B, origem A/destino B, com outro operation_id.
4. Crie EXIT CAM_SAIDA com outro operation_id. Isso não autoriza cancela.
5. Inverta A/B na câmera CAM_A_B: espere 422 e nenhuma inserção no histórico.
6. Crie nova passagem legítima A→B com novo operation_id: espere novo event_id.
7. Crie ENTRY ASSISTED sem placa: aceite local com placa e sessão nulas,
   sem confiança, sessão ou ticket fabricados. PASSAGE/EXIT sem placa exigem
   session_id já conhecido; fixtures de testes não são sessões reais.
8. Consulte `/api/v1/vision/events` e o resultado individual do evento.
9. Sem transporte configurado, `/events/{event_id}/send` permanece NOT_SENT.

Se ocorrer timeout/5xx no transporte configurado, mantenha o mesmo event_id e
trate o resultado como UNCERTAIN. Não gere novo ID para contornar a incerteza.
Retry automático exige garantia explícita do receptor; detalhes em
[HTTP_CLIENT.md](HTTP_CLIENT.md). Não há regras de sessões, pagamento ou
ocupação no Python.

## Demonstração HTTP em dois processos

Pare outros processos de demonstração que ocupem 19001/19002. Na pasta do
serviço, com o Python do venv:

```powershell
.venv/Scripts/python.exe tools/demo_http.py
```

O script inicia receptor mock e API em loopback, com configuração isolada do
`.env` do operador, e encerra os processos que iniciou. Testa ENTRY, PASSAGE e
EXIT nos cenários sucesso, 500 transitório, timeout transitório, 401, 403, 422
e 500 persistente. Confere número de chamadas, mesmo ID/payload e ausência de
nova transmissão após sucesso. Inclui entrada sem placa, rejeição de rota
inválida e passagem posterior legítima. Usa apenas dados fictícios de teste;
não consulta Java real. Se falhar, o processo termina com erro, não com sucesso
presumido. Para execução manual em dois terminais, veja HTTP_CLIENT.md.

## Vídeo local

Coloque somente MP4 autorizado em `videos/`, pasta ignorada pelo Git, ou
configure VIDEO_ROOT. Não existe upload nem streaming de vídeo no navegador.
No Swagger, envie `/api/v1/vision/analyze/start` com nome exato e sample_every.
Consulte `/api/v1/vision/status`; `/api/v1/vision/analyze/stop` solicita parada cooperativa.

A amostra local existente chama-se `License_Plate_Detection_Test_1080p.mp4`,
não `estacionamento.mp4`. Ela não é necessária para a suíte: os testes geram
um MP4 sintético temporário. Esta branch conta/amostra frames, mas não executa
OCR nem infere eventos a partir da presença de carros.

## Correções e regressões deste PY-08

- Destinos HTTP com caracteres de controle passavam pela configuração e podiam
  lançar InvalidURL não tratado no envio. Agora são rejeitados no startup,
  com mensagem sanitizada. Regressão reproduzida antes da correção.
- Falha de `VideoCapture.release()` podia interromper a atualização do estado
  terminal. Agora termina em error com orientação de reinício, sem expor a
  exceção interna nem alegar liberação bem-sucedida. Regressão testada com
  captura falsa; não é uma alegação de falha do codec no MP4 real.
- A suíte herdava configurações do shell: JAVA_IDEMPOTENCY_CONFIRMED=true
  alterava os resultados esperados de retry. Fixture agora isola configurações
  do operador; testes de precedência/configuração continuam explícitos.
- Testes cobrem API → registro → cliente HTTP → transporte mock, resultados
  no histórico, logs sem segredo/placa, reenvio incerto e conflito de operação.

## Matriz de aceite: não confundir local, mock e integração real

| Cenário | Evidência disponível | Pendência |
|---|---|---|
| ENTRY com placa | Modelos, API, envio e recepção mock | Sessão/ticket no Java real |
| ENTRY sem placa | ASSISTED local, payload nulo e mock | Sessão manual real |
| Mesmo event_id | Registro, concorrência, bytes preservados e mock | Persistência/idempotência Java |
| PASSAGE A→B | Mapa, evento, retry e nova passagem | Setor/estimativas atualizados no Java |
| Transição inválida | 422 sem inserir/enviar evento | Validação correspondente no Java |
| OCR falha | Caminho manual disponível; OCR não integrado | Placa real completa, fallback acoplado ao OCR |
| Receptor indisponível | Timeout/ConnectError em testes; timeout/500 via sockets locais | Indisponibilidade do Java real |
| Saída/pagamento/janela | Somente evento EXIT válido localmente | Autorização/negação pelo Java |
| Atualização do painel | Não executada | Fontes React e dados administrativos reais |
| Testes/build | pytest, pip check e mock HTTP | npm build, smoke React e teste ponta a ponta real |

## Evidências registradas em 14/11/2026

- Base: 71 testes passaram antes das alterações; pip check sem incompatibilidades.
- Suíte ampliada: **96 testes passaram**, sem skips, com um aviso de depreciação.
  Também passou com variável de idempotência do operador ativada para verificar
  isolamento. Isso não inclui testes OCR do PR #13 nem testes Java/React.
- `tools/demo_http.py` executado com os sete cenários e fluxos adicionais acima.
- Startup de produção com timeout inválido: processo falhou como esperado sem
  expor o valor inválido nem a chave fictícia fornecida.
- MP4 local autorizado: 1.800 frames lidos, 60 amostrados (sample_every=30),
  estado completed e health responsivo durante a leitura; sem execução de OCR.
- Nenhuma credencial real ou mídia entra nos commits. Logs próprios de entrega
  contêm ID de correlação, tentativa, estado e código HTTP; não corpo/placa/chave.

Avisos conhecidos: depreciação HTTPX no TestClient (não é falha); `moov atom
not found` é esperado no teste intencional de arquivo corrompido. Não foram
introduzidas atualizações de dependências para ocultar avisos.

## Bloqueios e operação

OCR real: PR #13 aberto, sem leitura completa correta demonstrada e sem conjunto
de fotos brasileiras reais autorizado validado. Java: contrato, autenticação,
respostas e efeitos de negócio ainda precisam ser confirmados contra Spring Boot.
React: `development` contém dist/node_modules, mas não fontes e manifesto do
aplicativo. PY-07 preservado, sem recriação do frontend.

Registros em memória desaparecem ao reiniciar. Reconcilie operações incertas
antes de reapresentá-las ao futuro receptor. Capacidade é 1.000 operações;
atingi-la rejeita novas operações sem descartar silenciosamente retries. Parada
de vídeo é cooperativa; decoder nativo travado exige encerramento do processo.
Use somente loopback; não há autenticação de operador no simulador e CORS não
substitui autenticação. Não conclua PY-08 com base apenas na matriz local.
