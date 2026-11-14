# PY-05 — transporte HTTP configurável, integração real pendente

Nenhuma rota Spring Boot foi confirmada. O cliente envia o JSON de `VisionEvent`
do PY-04 apenas para origem e caminho explicitamente configurados. Nenhuma regra
de sessão, ticket ou pagamento foi implementada. O mock abaixo é um receptor de
teste HTTP, não uma implementação Java nem evidência de compatibilidade real.

## Configuração do serviço Python

Atualize o venv com `python -m pip install -r requirements-dev.txt`. HTTPX agora
é dependência de execução. Configure no `.env` do serviço ou no ambiente:

| Variável | Significado / padrão |
|---|---|
| JAVA_API_BASE_URL | Origem HTTP(S), sem credenciais/query/caminho; ausente por padrão |
| JAVA_EVENTS_ENDPOINT | Caminho explícito de envio; ausente por padrão |
| INTERNAL_API_KEY | Segredo opcional enviado em X-Internal-API-Key; sem valor padrão |
| JAVA_TIMEOUT | Timeout HTTPX em segundos por fase de I/O, padrão 3, máximo 60 |
| JAVA_MAX_RETRIES | Máximo de retries automáticos, padrão 2, máximo 3 |
| JAVA_RETRY_DELAY | Espera entre tentativas, padrão 0,2 s, máximo 5 |
| JAVA_IDEMPOTENCY_CONFIRMED | false por padrão; true somente se receptor garantir idempotência por event_id |

Sem origem/caminho, o envio retorna NOT_SENT. Configurar somente um deles é erro
de startup. Não há descoberta de rota, redirect automático ou proxy herdado do
ambiente. Certificados HTTPS são verificados. Configure HTTPS para servidor
real fora da máquina local. Nenhuma chave é enviada pelo navegador: a configuração
fica no backend; não inclua segredo no JSON de eventos. Não habilite logs DEBUG
de transporte em ambientes com dados privados.

## Envio explícito e resultados

1. Crie o evento pelo simulador documentado em SIMULATOR.md.
2. Copie o event_id retornado.
3. Execute `POST /api/v1/vision/events/{event_id}/send` sem corpo via `/docs`.
4. Consulte o histórico/resultado existente para ver `transport_result`.

Criar/simular um evento não o envia automaticamente. O novo endpoint recupera
o evento original e passa por `registry.retry` antes do mesmo cliente reutilizável
por futuros produtores. Não aceita outro payload para o mesmo ID.

- `HTTP_ACKNOWLEDGED`: HTTP 2xx recebido, inclusive 202/204. Não comprova
  persistência, sessão ou ticket. O corpo de resposta não é interpretado nem
  exposto enquanto seu contrato estiver indefinido.
- `FAILED`: resposta não 2xx que não é 5xx (inclui 401, 403, 422 e redirects).
- `UNCERTAIN`: 5xx, timeout ou erro de rede; pode ter ocorrido efeito remoto.
- `NOT_SENT`: destino não configurado.

Quando configurado, `java_integration=CONFIGURED_UNVERIFIED` sempre, inclusive
ao conversar com o mock. Caso contrário, UNAVAILABLE. Não é detecção automática
do tipo de servidor nem alegação de integração validada. `status=LOCAL_VALIDATED`
continua descrevendo a validação local, independentemente do resultado HTTP.

Logs próprios contêm somente event_id, tentativa, estado e código HTTP. Não
registram headers, placa, sessão, corpo ou texto de exceções remotas. A resposta
local contém códigos de erro genéricos, sem corpo remoto ou segredo.

## Política de retry

Sem garantia configurada: uma tentativa. Após uma tentativa, o registro local
retorna o resultado anterior em reenvios, bloqueando duplicação incerta. Corrija
a integração/reconcilie o receptor; não crie um novo event_id para contornar isso.
Com garantia: retries limitados em timeout/erro de rede e HTTP 500/502/503/504,
preservando exatamente bytes do evento e event_id. Não há retry automático para
401/403/422 ou redirects. Um novo envio manual de falha, quando idempotência
está confirmada, pode iniciar outro ciclo limitado; não há fila automática infinita.

Resultados 2xx são reutilizados sem retransmissão. Envios são serializados por
um lock no MVP para impedir concorrência duplicada; consulta de resultado pode
aguardar o envio, mas health roda independentemente. Registro é em memória por
processo, limitado pelo registro de eventos; reinício perde resultados. Não
há garantia de exactly-once após reinício nem entre múltiplos workers.

## Mock local e demonstração reproduzível

Use apenas loopback e dados fictícios no mock. Ele tem cenários de transporte,
contador de chamadas e verificação de payload por ID; não cria sessões/tickets.
As rotas `/mock/*` são exclusivamente de teste e não propostas para o Java.

Terminal 1, dentro da pasta do serviço, usando Python do venv:

```powershell
.venv/Scripts/python.exe -m uvicorn tools.mock_java:app --host 127.0.0.1 --port 9001
```

O mock usa a credencial pública de teste `local-mock-only` por padrão, substituível
por MOCK_API_KEY. Configure o Python no terminal 2:

```powershell
$env:JAVA_API_BASE_URL='http://127.0.0.1:9001'
$env:JAVA_EVENTS_ENDPOINT='/mock/ok'
$env:INTERNAL_API_KEY='local-mock-only'
$env:JAVA_IDEMPOTENCY_CONFIRMED='true'
.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Linux: use `.venv/bin/python` e `export NOME=valor`. Credencial acima não é real;
nunca substitua exemplos versionados por segredo real. Cenários alternativos:
`/mock/500-once`, `/mock/timeout-once`, `/mock/401`, `/mock/403`, `/mock/422`,
`/mock/500`; ajuste a variável e reinicie só o serviço Python. Para o timeout,
use JAVA_TIMEOUT=0.3; o mock espera um segundo na primeira chamada. 500-once e
timeout-once registram o ID antes de falhar para testar o reenvio incerto.

Demonstração automatizada real em dois processos:

```powershell
.venv/Scripts/python.exe tools/demo_http.py
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m pip check
```

O script ocupa 19001/19002 temporariamente e encerra os processos que iniciou.
Não lê o `.env` do operador; usa configuração explícita do mock e o mapa de exemplo
somente nos processos filhos. Não altera configurações ou arquivos do operador.
Testa ENTRY/PASSAGE/EXIT nos sete cenários, número de tentativas, preservação
do ID/payload e cache local de sucesso, além de entrada sem placa, transição
inválida e passagem posterior legítima. Não usa servidor Spring Boot.

## Pendências obrigatórias para Java real

Confirmar método/rota, autenticação, payload, schema de respostas, significado
de 2xx, idempotência e retenção de event_id. Depois comprovar ENTRY com sessão/
ticket reais, transições e efeitos únicos no Java. Sem isso, PY-05 continua
parcial: transporte e mock validados, integração real bloqueada. PR #13 e código
Java/React não foram alterados.
