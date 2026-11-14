# JV-03 — sessões, setores e ocupação estimada

Issue #21. Base origin/develop e99c3b1, PR #27 integrado. Código Java 21;
fontes Python/React preservados. [Contrato atual](../../docs/API_CONTRACT.md).

## Resultado e limite de saída

ENTRY cria sessão persistente ACTIVE no setor de entrada. PASSAGE move o último
setor conhecido se câmera, identidade, origem, data e capacidade forem válidas.
Ocupação é uma estimativa calculada pelas sessões ativas; não existe vaga exata.

**EXIT não está liberado:** retorna 403 exit_authorization_required, conserva
sessão ACTIVE e ocupação. JV-06 ainda precisa emitir/validar autorização real
do fluxo demonstrativo. Não há flag, endpoint manual ou simulação de pagamento
para contornar essa regra. Encerramento autorizado não foi implementado/testado.

Entrada sem placa recebe session_id gerado no Java. Consultar o recibo interno
para recuperá-lo e enviá-lo em PASSAGE/EXIT. Não associar placa inventada. Nova
ENTRY com placa já ativa é rejeitada; ENTRY com session_id também é rejeitada.

## Executar e configurar no Windows

Na pasta backend/parking-core-java:

```powershell
$env:JAVA_HOME = 'C:/Users/USER/.jdks/ms-21.0.7'
$env:MAVEN_USER_HOME = Join-Path (Get-Location) '.cache/maven'
./mvnw.cmd -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify
$env:CORE_BIND_ADDRESS = '127.0.0.1'
$env:CORE_PORT = '8080'
$env:CORE_DB_PATH = Join-Path (Get-Location) 'data/demo-jv03.db'
$env:CORE_LAYOUT_PATH = Join-Path (Get-Location) 'parking.example.json'
# Digitar a mesma chave privada (32..256 ASCII sem espaços) nos dois terminais.
$taskKey = Read-Host 'Chave interna privada' -AsSecureString
$env:INTERNAL_API_KEY = [System.Net.NetworkCredential]::new('', $taskKey).Password
& "$env:JAVA_HOME/bin/java.exe" -jar target/parking-core-java-0.1.0-SNAPSHOT.jar
```

Java do PATH nesta máquina é 17. Selecionar JAVA_HOME=21 por terminal; o JAR
não funciona com Java 17. Não instalar nada globalmente. `.env.example` é
referência; Spring não lê `.env` automaticamente. Banco, chave e logs não vão ao Git.

Em outro terminal, na pasta backend/parking-vision-python e com venv preparado:

```powershell
$env:JAVA_API_BASE_URL = 'http://127.0.0.1:8080'
$env:JAVA_EVENTS_ENDPOINT = '/api/v1/internal/vision-events'
$env:JAVA_IDEMPOTENCY_CONFIRMED = 'true'
$taskKey = Read-Host 'Mesma chave interna privada' -AsSecureString
$env:INTERNAL_API_KEY = [System.Net.NetworkCredential]::new('', $taskKey).Password
.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Usar Swagger em http://127.0.0.1:8000/docs: simulate registra a operação local;
send envia ao Java. O endpoint send retorna envelope HTTP 200 mesmo quando
Java rejeita: conferir delivery e transport_result.http_status (por exemplo
FAILED/403). `java_integration=CONFIGURED_UNVERIFIED` é um rótulo fixo do Python
existente; não substitui a consulta ao estado real Java feita nesta demonstração.

Consultas Java exigem X-Internal-API-Key, somente por operador/serviço autorizado:
/api/v1/internal/sessions, /sessions/{id}, /sectors, /dashboard e
/vision-events/{event_id}. Não entregar essa chave ao navegador/React.
Não foi implementada autenticação administrativa de usuário neste card.

Linux: JAVA_HOME apontando JDK 21, `sh ./mvnw ... clean verify`, export das mesmas
variáveis e `.venv/bin/python` para FastAPI/demo. Linux não foi executado.

## Layout e persistência

parking.example.json configura A e B com 20 lugares cada, entrada em A,
CAM_A_B A→B e saída em B. São **capacidades de exemplo**, configuráveis em
CORE_LAYOUT_PATH; não representam medição ou estacionamento real.

Capacidades podem ser alteradas no arquivo e aplicadas após reiniciar, desde
que não fiquem abaixo da ocupação ativa. IDs de setores e mapa de câmeras/rotas
ficam vinculados ao banco; alterações exigem migração explícita. Não editar
tabelas manualmente nem apagar banco do operador para resolver incompatibilidade.

Schema SQLite 1/2→3 migra atomicamente; fazer backup antes de atualizar. Não
executar binários JV-01/JV-02 no schema 3. Recibos antigos RECORDED continuam
idênticos e não geram sessões retroativas. Novos eventos têm APPLIED ou REJECTED.
Evento, recibo HTTP e mudança de sessão são uma transação. Falha SQL reverte tudo.

Reenvio idêntico devolve status/recibo original, inclusive se foi rejeitado.
Se a condição mudar (vaga liberada, futura autorização de saída), uma nova
tentativa lógica deve usar novo operation_id/event_id. Não mudar o ID de uma
operação cujo resultado ficou incerto por timeout; primeiro reenviar/consultar.

## Demonstração reproduzível — dois serviços reais

```powershell
# Na pasta Java, depois de clean verify e JAVA_HOME=21:
../parking-vision-python/.venv/Scripts/python.exe -u tools/demo_vision_events.py
```

O script inicia FastAPI e o JAR Spring Boot em portas locais livres, com chave,
layout e SQLite temporários próprios. Usa os endpoints FastAPI existentes;
consulta recibos, sessões e ocupação pela API Java, sem acessar seu banco.
Não lê o .env do operador, não processa vídeo/OCR, não instala dependências
e encerra somente seus processos. Não executar Python com -O.

Resultado executado em 14/11/2026, Windows / Microsoft JDK 21.0.7:

| Cenário real | Resultado |
|---|---|
| ENTRY pelo FastAPI | Java200, sessão ACTIVE em A, ocupação estimada 1 |
| PASSAGE A→B | Mesma sessão em B; A=0, B=1; replay não altera contagens |
| EXIT | Java403, Python FAILED; sessão continua ACTIVE; motivo de autorização pendente |
| ASSISTED sem placa | session_id real retornado; passagem por esse ID, placa continua null |
| Transição impossível / conteúdo conflitante | Java409, contagens preservadas |
| Consulta/envio sem autenticação | Java401 |
| Java parado | FastAPI informa UNCERTAIN/timeout após 3 tentativas limitadas |
| Java reiniciado, mesmo banco | Sessões/recibos preservados; ENTRY incerta recuperada com mesmo ID |
| Destino B lotado | Java409 sector_full; A=1, B=2, capacidade2 cada |

Logs dos processos conferidos sem a chave e sem placas de teste. Dados da demo
são explicitamente ASSISTED; não representam reconhecimento OCR.

## Testes e critérios

- Baseline: 52 testes Java passando antes do trabalho.
- Novos testes iniciais: 18 falharam antes da implementação (17 falhas e 1 erro
  por tabela inexistente); passaram após implementar. Concorrência de passagens
  foi adicionada à cobertura.
- `./mvnw.cmd -o -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify`:
  **71 testes**, zero falhas/erros/skips; BUILD SUCCESS e JAR gerado.
- Python `pytest -q`: **96 passed, 1 warning** de depreciação preexistente;
  `pip check`: No broken requirements found. Não alteradas dependências.
- HTTP real e SQLite temporário: identidade, placa ativa única, datas fora de
  ordem, câmeras/transições, paginação/autenticação, replay/restart, migração
  de recibos JV-02, capacidade configurável e validação de configuração.
- Concorrência entre duas instâncias: 12 entradas disputando uma vaga geram
  uma sessão; duas passagens disputando destino de capacidade1 movem uma sessão.
- Falha SQL induzida ao salvar recibo reverte a nova sessão ou a mudança de setor
  e o evento. Após remover a falha, retry do mesmo ID funciona.
- Revisão independente sem achados. Smoke adicional com duas JVMs isoladas
  validou 16 entradas disputando uma vaga, identidade conflitante, replay após
  vaga liberada/reinício, entrada anônima, autenticação e saída negada.

Aceite comprovado: ENTRY inclusive manual, PASSAGE válida/invalidade, duplicação,
capacidade e ocupação estimada não negativa, persistência e consultas reais,
EXIT não autorizado sem encerramento. **Aceite pendente: EXIT autorizado encerra
sessão** — depende do JV-06 e não foi marcado como concluído. Tickets, pagamentos,
React, OCR real, deploy público e encerramento do ciclo JV-04 não comprovados.
