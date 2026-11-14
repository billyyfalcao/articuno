# JV-01 — evidências de validação

Executado em 14/11/2026, Windows, Microsoft OpenJDK 21.0.7, Maven 3.9.11 via
Wrapper 3.3.4. Base da branch: origin/develop `13a059c`. Issue #19.

## Build e testes

Na pasta do serviço, JAVA_HOME apontando para JDK 21:

```powershell
$env:MAVEN_USER_HOME = Join-Path (Get-Location) '.cache/maven'
./mvnw.cmd -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify
```

Resultado final: **BUILD SUCCESS; 16 testes, zero falhas, zero erros e zero skips**.
JAR executável gerado em `target/parking-core-java-0.1.0-SNAPSHOT.jar`.
Maven foi baixado do repositório Apache, conferido por SHA-512; o Wrapper fixa
URL/versão e SHA-256 da distribuição. Nenhum binário/cache entra no commit.

Os testes iniciais falharam antes da implementação: health 404, ausência de
DataSource e configurações inválidas aceitas. O cenário posterior de banco
corrompido retornava 500; passou a retornar 503 sanitizado após o handler.
Foi corrigida a preparação dos testes que duplicava argumentos de configuração,
para validar de fato cada valor isoladamente.

Revisão independente encontrou expansão de placeholders Spring que podia
revelar o valor antes da validação. Três regressões reproduziram o problema;
agora falhas de resolução são sanitizadas sem preservar a causa. Também foi
reproduzida interferência de CORE_BIND_ADDRESS do operador nos testes; a suíte
fixa seu próprio loopback. O clean verify final passou com bind externo herdado
no shell, comprovando o isolamento.

| Critério JV-01 | Evidência |
|---|---|
| Serviço inicia / health 200 | HTTP real com Spring Boot em porta efêmera; JAR executado separadamente |
| Persistência funciona | Arquivo SQLite real; dado de teste preservado após reinício de contexto e após reinício do processo JAR |
| Configurações inválidas tratadas | Portas negativa/acima de 65535/texto, bind inválido, caminho vazio/memória/URI, caminho inacessível, esquema incompatível |
| Falhas HTTP sanitizadas | Banco corrompido retorna 503 sem SQL/caminho/stack trace; 404/405 preservados |
| Segredos/artefatos locais | Sem chave necessária no JV-01; .env, DB, target, ferramentas/cache ignorados |
| Instalação/execução | README Windows/Linux; Windows executado, Linux somente documentado |

## JAR em processos separados

Dois processos Java foram iniciados sequencialmente com o mesmo CORE_DB_PATH,
portas livres e CORE_BIND_ADDRESS=127.0.0.1. Cada um respondeu HTTP 200
`{"status":"ok"}`. Entre execuções, uma conexão SQLite independente inseriu
um marcador técnico; após reiniciar o JAR, a consulta confirmou sua preservação.
Os processos desse ensaio foram encerrados, sem interferir em outros serviços.

Outra execução usou CORE_PORT inválido: **exit code 1**, mensagem identificando
CORE_PORT e nenhuma reprodução do valor de teste privado nos logs. Isso testa
o entry point real, além dos testes de contexto Spring.

Após a revisão, o JAR final também foi executado com placeholder inválido em
CORE_PORT, CORE_BIND_ADDRESS e CORE_DB_PATH, separadamente: todos retornaram
exit code 1, identificaram a variável e não expuseram o marcador privado.

Regressão Python: `pytest -q` retornou **96 passed, 1 warning** (depreciação
preexistente HTTPX/TestClient), e `pip check` retornou **No broken requirements
found**. Nenhum arquivo Python foi alterado. A mensagem OpenCV de arquivo
corrompido vem da fixture intencional da suíte Python.

## Limites comprovados

- Não é teste Python → Java. O receptor de eventos será JV-02 e o fluxo real,
  JV-04; não há endpoint de evento, sessão, ticket, setor ou pagamento aqui.
- Não houve teste de frontend, OCR real, carga, múltiplas réplicas ou Linux.
- SQLite é persistente local; esta etapa não implementa backup, migrações de
  negócio ou operação em filesystem compartilhado.
- O servidor usa loopback por padrão. Exposição pública, autenticação interna,
  autorização administrativa e CORS exigem próximas etapas; não houve deploy.
- PR #13 preservado. A amostra solicitada como estacionamento.mp4 não existe;
  o nome real está documentado no README, sem mídia incluída no commit.
