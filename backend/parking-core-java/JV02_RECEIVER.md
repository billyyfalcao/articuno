# JV-02 — receptor autenticado e idempotência

**Registro histórico do JV-02.** O código e a demo atuais evoluíram no JV-03:
novos eventos aplicam regras de sessão; EXIT é rejeitado até JV-06. Recibos
legados RECORDED são preservados. Usar [JV03_SESSIONS.md](JV03_SESSIONS.md)
e o contrato atual para execução; resultados abaixo descrevem a versão JV-02.

Base: develop em `885b354`, com JV-01 integrado pelo PR #26. Issue #20.
Contrato implementado: [docs/API_CONTRACT.md](../../docs/API_CONTRACT.md).

## Executar

Usar JDK 21 já instalado. No PowerShell, a partir da pasta deste serviço:

```powershell
$env:JAVA_HOME = 'C:/Users/USER/.jdks/ms-21.0.7'
$env:MAVEN_USER_HOME = Join-Path (Get-Location) '.cache/maven'
./mvnw.cmd -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify
```

Configurar INTERNAL_API_KEY com um segredo local de 32..256 caracteres ASCII
sem espaços, igual nos dois backends. Não imprimir nem commitar o valor.
Manter CORE_BIND_ADDRESS/CORE_PORT/CORE_DB_PATH conforme README. Então executar
o JAR com `& "$env:JAVA_HOME/bin/java.exe" -jar target/parking-core-java-0.1.0-SNAPSHOT.jar`.
`.env.example` é referência; Java não carrega `.env` automaticamente.

No Python, configurar JAVA_API_BASE_URL (por exemplo http://127.0.0.1:8080 na
demo local), JAVA_EVENTS_ENDPOINT=/api/v1/internal/vision-events e a mesma
INTERNAL_API_KEY. A implementação garante idempotência persistente de registro
por event_id; JAVA_IDEMPOTENCY_CONFIRMED=true habilita o retry limitado existente.
Não colocar a chave no frontend. Sem chave Java, rotas internas retornam 503.

No Swagger Python, criar evento por `/api/v1/vision/events/simulate` e enviar
seu event_id por `/api/v1/vision/events/{event_id}/send`. O código Python existente
foi preservado. O cliente não interpreta o recibo Java: HTTP_ACKNOWLEDGED
comprova transporte 2xx, não sessão/ticket. Consultar o GET interno autenticado
do contrato para verificar o evento e recibo persistidos.

## Demonstração automatizada real

```powershell
# Na pasta backend/parking-core-java, JAVA_HOME configurado como acima:
../parking-vision-python/.venv/Scripts/python.exe tools/demo_vision_events.py
```

O script usa EventRegistry, Observation e JavaClient originais do Python,
inicia o JAR Spring Boot em loopback e gera chave e banco temporários. Confere
ENTRY, PASSAGE, EXIT, entrada assistida sem placa, replay, conflito, invalidez,
autenticação, Java parado e recuperação após reinício. Verifica registros por
REST, sem acessar diretamente o banco. Encerra apenas seu processo Java e remove
somente os arquivos temporários próprios. Precisa do venv Python já preparado;
não instala pacotes nem modifica .env. Não execute com Python -O, que desliga
as asserções usadas pela demonstração.

Isso é **produtor/cliente Python → Spring Boot real**, não mock. Não inicia
o servidor FastAPI nem React e não comprova o ciclo de negócio do JV-04.
Todos os dados são explicitamente SIMULATION/ASSISTED; não executa OCR real.

Linux: usar JAVA_HOME do JDK 21, `sh ./mvnw ... clean verify` e
`../parking-vision-python/.venv/bin/python tools/demo_vision_events.py`.
Linux está documentado, não foi executado no ambiente Windows desta entrega.

## Cobertura

Testes HTTP reais em porta efêmera e SQLite temporário cobrem os payloads
gerados pelo modelo Python, nulos, enums, tipos, placa/confiança, UUID/fuso,
JSON estrito, autenticação antes do corpo, limite de tamanho, migração 1→2,
consulta, repetição, conflito, reinício e concorrência entre duas aplicações.
Reenvios preservam resposta e banco; uma passagem posterior com novo ID é aceita.

Fixtures em src/test/resources/vision-events-python.json foram geradas usando
VisionEvent.model_dump_json() da develop, sem alterar o produtor.

## Evidências executadas em 14/11/2026

Ambiente Windows, Microsoft JDK 21.0.7, Maven Wrapper 3.9.11. Nesta máquina,
Java no PATH continua 17; o build e a demo selecionaram JAVA_HOME explicitamente.

| Verificação | Resultado real |
|---|---|
| `./mvnw.cmd -o -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify` | BUILD SUCCESS; 52 testes, 0 falhas/erros/skips; JAR gerado |
| Python: `.venv/Scripts/python.exe -m pytest -q` | 96 passed, 1 warning preexistente de depreciação HTTPX/TestClient |
| Python: `.venv/Scripts/python.exe -m pip check` | No broken requirements found |
| `tools/demo_vision_events.py` contra o JAR atualizado | PASS; ENTRY/PASSAGE/EXIT 200, consulta e replay com recibo idêntico |
| Entrada ASSISTED sem placa | Registro confirmado; nenhuma sessão/ticket fabricado |
| Conflito / transição inválida / chave ausente ou incorreta | 409 / 422 / 401; evento inválido ausente na consulta |
| Java parado | Python UNCERTAIN/timeout após 3 tentativas limitadas |
| Reinício com o mesmo banco temporário | IDs e recibos originais preservados; replay aceito |

Os 52 testes incluem 16 da estrutura e 36 do receptor. A revisão independente
identificou três casos de borda, reproduzidos antes da correção: chave com
`${...}` interpretada, expoente numérico extremo retornando 500 e fusos Python
acima de 18 horas rejeitados. Regressões corrigidas e incluídas na suíte final.
Concorrência usa 12 requisições entre duas instâncias no mesmo banco e verifica
um único registro. A demo confere ausência da chave e placas de teste nos logs.
Linux, navegador/React e ciclo de sessões/pagamentos não foram testados.

## Limites

RECORDED significa apenas registro durável. Nenhuma sessão, ocupação, ticket,
pagamento ou autorização de saída foi implementada. Validação da identidade de
câmeras/setores configurados e regras de negócio ficam no JV-03. O receptor
valida a estrutura e relações de campos do evento, sem inventar esses cadastros.

O schema SQLite sobe de 1 para 2; fazer backup antes de atualizar e não voltar
ao binário JV-01 com esse arquivo. Não há expiração dos IDs nem exclusão
automática. Continuação: revisão/merge JV-02, depois JV-03 em develop atualizada.
PR #13 e frontend permanecem preservados; não houve publicação na internet.
