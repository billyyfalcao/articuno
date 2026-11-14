# Articuno Parking Core — JV-01

Estrutura Java independente do OCR e do frontend. Implementa **somente
`GET /health`**, configuração e persistência SQLite. Ainda não recebe eventos
Python, não cria sessões/tickets e não calcula pagamentos ou ocupação.

Base: `origin/develop` em `13a059c`, após PR #18. Issue [JV-01/#19](https://github.com/billyyfalcao/articuno/issues/19).
Python, React, documento original e PR #13 foram preservados.

## Requisitos e decisões

- JDK 21. No ambiente validado há Microsoft OpenJDK 21.0.7 em
  `C:/Users/USER/.jdks/ms-21.0.7`, enquanto o Java do PATH é 17. Configure
  JAVA_HOME para o seu JDK 21; não copie esse caminho para outra máquina.
- Maven Wrapper 3.3.4, Maven 3.9.11 com SHA-256 fixado. Não precisa instalar
  Maven globalmente. Primeiro build precisa de internet para dependências.
- Spring Boot 3.5.16, Spring JDBC e Xerial SQLite JDBC 3.54.1.0.
  [Compatibilidade Spring Boot](https://docs.spring.io/spring-boot/3.5/system-requirements.html)
  e [driver SQLite](https://github.com/xerial/sqlite-jdbc).
- SQLite foi viável: nenhum desvio para H2. Não há ORM, broker ou serviço de
  banco externo. Caminho do arquivo é configurável; conexões habilitam chaves
  estrangeiras e busy timeout de 5 segundos.
- O esquema inicial tem apenas `app_metadata` com `schema_version=1`.
  Inicialização repetida preserva dados; versão de esquema incompatível
  impede startup. Migrações de tabelas de negócio ficam nos próximos cards.

## Windows / PowerShell

Na raiz do repositório, usando o caminho do JDK 21 instalado na sua máquina:

```powershell
cd backend/parking-core-java
$env:JAVA_HOME = 'C:/Users/USER/.jdks/ms-21.0.7'
$env:MAVEN_USER_HOME = Join-Path (Get-Location) '.cache/maven'
./mvnw.cmd -B -ntp '-Dmaven.repo.local=.cache/repository' clean verify
$env:CORE_BIND_ADDRESS = '127.0.0.1'
$env:CORE_PORT = '8080'
$env:CORE_DB_PATH = Join-Path (Get-Location) 'data/articuno.db'
& "$env:JAVA_HOME/bin/java.exe" -jar target/parking-core-java-0.1.0-SNAPSHOT.jar
```

Em outro terminal: `Invoke-RestMethod http://127.0.0.1:8080/health`.
Encerre com Ctrl+C. O Maven Wrapper e a cache não alteram a instalação global.
Se usar Maven já instalado, a alternativa é `mvn clean verify` com JDK 21.

## Linux

Instruções preparadas, **não executadas neste ambiente Windows**:

```bash
cd backend/parking-core-java
export JAVA_HOME=/caminho/do/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"
export MAVEN_USER_HOME="$PWD/.cache/maven"
sh ./mvnw -B -ntp -Dmaven.repo.local=.cache/repository clean verify
export CORE_BIND_ADDRESS=127.0.0.1
export CORE_PORT=8080
export CORE_DB_PATH="$PWD/data/articuno.db"
java -jar target/parking-core-java-0.1.0-SNAPSHOT.jar
# Em outro terminal: curl --fail http://127.0.0.1:8080/health
```

## Configuração e erros

| Variável | Padrão | Validação |
|---|---|---|
| CORE_PORT | 8080 | Inteiro 0..65535; 0 solicita porta livre, útil nos testes |
| CORE_BIND_ADDRESS | 127.0.0.1 | IPv4 numérico; padrão restrito à máquina local |
| CORE_DB_PATH | ./data/articuno.db | Arquivo SQLite local, relativo ao diretório de execução ou absoluto; sem URI, query, fragmento ou caracteres de controle |

Os nomes CORE_* são a configuração deste serviço, incluindo porta e bind;
não configure SERVER_PORT como alternativa. Não há URLs de serviços externos
no código JV-01. Os endereços localhost deste README são exemplos locais.

`.env.example` é referência: **Spring Boot não carrega `.env` automaticamente**.
Exporte variáveis no shell; não sobrescreva `.env` existente. Não existe chave
interna necessária neste card: autenticação de eventos pertence ao JV-02.
`data/`, bancos, `.env`, `.tools/`, `.cache/`, logs e `target/` são ignorados.

`GET /health` retorna HTTP 200 e `{"status":"ok"}` após consultar o banco.
Falha de acesso durante a requisição retorna HTTP 503 com
`{"error":"database_unavailable"}`, sem SQL/caminho/stack trace. Rota inexistente
retorna 404; método incorreto retorna 405. Configuração inválida ou banco
inacessível no startup impedem a inicialização com mensagem sanitizada que
identifica a configuração a conferir. Não habilite logs DEBUG de infraestrutura
para demonstração com dados privados.

Health não comprova integração Python, OCR, sessões ou autorização de saída.
Não há autenticação de operador ou CORS liberado no Java nesta etapa; o único
endpoint é a saúde e o bind padrão é loopback. Não exponha pela internet apenas
mudando o bind: os controles planejados abaixo ainda precisam ser implementados.

## Testes

`clean verify` compila, testa e gera o JAR executável. A suíte usa Spring Boot
real em porta efêmera, cliente HTTP do JDK e SQLite em arquivos temporários;
não usa H2 ou mock de banco.

Cobertura: health 200, persistência após reinício de contexto, acesso JDBC
independente ao mesmo arquivo, chaves estrangeiras habilitadas, porta/bind/
caminho inválidos, caminho inacessível, versão de esquema incompatível,
banco corrompido após startup (503 sanitizado), 404 e 405.

Resultados e limitações desta execução estão em [VALIDATION.md](VALIDATION.md).
Não confundir esta prova com o JV-04: ainda não existe endpoint interno que o
cliente HTTP Python possa utilizar.

## Próximos cards e execução conjunta no Windows

Após revisão/merge do JV-01, iniciar JV-02 a partir de develop atualizada.
Documentar contrato em `docs/API_CONTRACT.md` usando o modelo Python real:
event_id UUID, ENTRY/PASSAGE/EXIT, fontes OCR/ASSISTED/**SIMULATION**, timestamps
com fuso, confiança nula no manual e suporte a entrada sem placa.
JV-03 implementará sessões/ocupação; JV-04 comprovará comunicação real.
A saída positiva depende de uma regra explícita de autorização; não liberar
EXIT artificialmente para antecipar a demo antes do JV-06.

Para preparar a demonstração local, abrir terminais separados:

1. **Java:** comandos acima, porta 8080 configurável.
2. **Python:** na raiz, `cd backend/parking-vision-python` e
   `.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000`.
   Usar os passos de instalação do README Python. A porta é argumento do Uvicorn.
   Deixar JAVA_API_BASE_URL/JAVA_EVENTS_ENDPOINT sem configuração nesta etapa:
   definir ambos apenas quando JV-02 documentar a rota real. A chave interna
   ficará somente nos backends. Retry requer idempotência comprovada.
3. **React:** bloqueado até o colega publicar `src`, manifesto/lockfile e
   configurações. Então seguir os scripts reais do projeto único, configurar
   origens Python/Java no frontend e CORS correspondente nos servidores.
   Não há comando npm validado nem comunicação React ↔ Java comprovada agora.

As variáveis frontend para os dois backends serão acordadas na recuperação
das fontes. Preservar autenticação administrativa e `/ticket/:token`; não
incluir X-Internal-API-Key no navegador. Nenhum frontend foi alterado aqui.

## Vídeo e monitoramento planejado

O caminho solicitado `../parking-vision-python/videos/estacionamento.mp4`
não existe no checkout conferido. A amostra disponível é
`../parking-vision-python/videos/License_Plate_Detection_Test_1080p.mp4`.
Não renomeada, copiada ou commitada. Confirmar o nome ao usar o endpoint
Python de início; vídeo autorizado fica somente em pasta local ignorada.

Quando PY-07 for desbloqueado: player MP4 local selecionado pelo operador,
arquivo correspondente disponível ao processador, polling dos endpoints reais
FastAPI e rótulos ASSISTED/SIMULATION. O Python atual não oferece streaming/upload;
uma URL de MP4 público exige fornecimento autorizado separado. Não mostrar OCR
como pronto: PR #13 permanece aberto e sem placa real completa comprovada.
Sobreposições só devem representar bounding boxes efetivamente produzidas.

## Link para avaliadores — plano, não implantação

Possível opção de demonstração futura: uma máquina/VM com volume persistente,
serviços Python e Java e o único build React, acessíveis por proxy HTTPS. Rotas
externas e origens serão acordadas com o frontend; usar variáveis de ambiente
para URLs, portas e origens permitidas. Não há deploy, Docker, tunnel, domínio
ou link público criado nesta Issue.

Antes de expor: autenticação e autorização administrativa, proteção dos comandos
de simulação/análise Python, segredo interno apenas entre serviços, TLS, CORS
restrito, limites de requisição, logs sem dados privados e armazenamento
persistente/backups para SQLite. Não colocar o banco em filesystem efêmero,
compartilhamento de rede ou múltiplas réplicas escrevendo simultaneamente.
Planejar distribuição do MP4 autorizado sem subir vídeos privados ao Git.
Testar reinício, health e fluxo real após publicar; apresentação via internet
não implica prontidão para produção. Estas alterações exigem etapa autorizada.
