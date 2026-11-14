# Articuno — demonstração integrada

O frontend React/Vite em `frontend/` reutiliza o design e os componentes visuais do protótipo autorizado, com adaptadores para os contratos existentes. Não inclui React UMD, builds do colega ou outro projeto React. As fontes de referência permanecem preservadas localmente em `prototipo_referencia/`.

## O que está integrado

- `/admin`: setores, capacidade, ocupação **estimada**, sessões e indicadores reais do Spring Boot; eventos locais do FastAPI.
- `/admin/cameras`: câmeras lógicas, estado/amostragem do MP4, início/parada, criação assistida de ENTRY/PASSAGE e envio explícito ao Java. Mostra o resultado Python e, quando disponível, o recibo persistido Java.
- `/totem/entrada`: os mesmos setores reais, atualizados a cada 2,5 segundos. Sugestão pela menor taxa de ocupação, desempate por vagas livres; desenho ilustrativo, sem distâncias ou tempos inventados.
- Modo **Contingência visual — DADOS SIMULADOS**, selecionado explicitamente em Configurações; somente leitura. Falhas de API nunca ativam mocks automaticamente.

O navegador acessa somente o servidor do frontend. Esse servidor encaminha as rotas permitidas ao Python/Java e acrescenta a chave interna exclusivamente nas chamadas Java. Python envia os eventos ao Java pelo cliente já existente. Não houve alteração dos backends nesta integração.

## Preparação no Windows (PowerShell)

Pré-requisitos: Git, Node.js 24 LTS/npm, Python compatível com o backend e JDK 21. O JDK desta máquina está em `C:\Users\USER\.jdks\ms-21.0.7`; o Java 17 do PATH não executa o JAR Java 21.

Na raiz do repositório:

```powershell
$env:JAVA_HOME = 'C:\Users\USER\.jdks\ms-21.0.7'
$env:ARTICUNO_JAVA_HOME = $env:JAVA_HOME
& "$env:JAVA_HOME\bin\java.exe" -version

Push-Location backend/parking-core-java
./mvnw.cmd -B -ntp verify
Pop-Location

Push-Location backend/parking-vision-python
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
./.venv/Scripts/python.exe -m pytest -q
./.venv/Scripts/python.exe -m pip check
Pop-Location

Push-Location frontend
npm ci
npm test
npm run build
Pop-Location
```

Não recrie o ambiente virtual quando já existir. Para usar o cache Maven já preparado nesta máquina, exporte `MAVEN_USER_HOME` apontando para `backend/parking-core-java/.cache/maven` e acrescente `-o '-Dmaven.repo.local=.cache/repository'` ao comando Maven dentro da pasta Java. A opção `-o` exige dependências previamente baixadas.

## Iniciar e desligar

```powershell
# Na raiz do repositório. Alternativa sem execução de .ps1: node scripts/demo.mjs start
./scripts/start-demo.ps1
```

Abra **http://localhost:5173/admin**. O navegador pede autenticação HTTP. Consulte o usuário e a senha privados gerados na máquina:

```powershell
Get-Content .demo/access.json
```

Não compartilhe esse arquivo publicamente. A senha do navegador é diferente da chave interna. `.demo/runtime.json` contém as configurações privadas; `.demo/parking.db` mantém as sessões entre reinícios; `.demo/*.log` contém os logs. Toda a pasta está ignorada pelo Git. O histórico de operações Python continua em memória, conforme o backend existente; reiniciá-lo perde esse histórico, mas preserva o SQLite Java.

O script inicia Java, Python e servidor React em segundo plano, somente em `127.0.0.1`, e verifica `/health` em cada um. Portas ocupadas geram erro: nenhum processo alheio é encerrado. Para parar somente os processos identificados como pertencentes a esta demonstração:

```powershell
./scripts/stop-demo.ps1
# Alternativa:
node scripts/demo.mjs stop
# Reinício de apenas um serviço, útil para testar indisponibilidade:
node scripts/demo.mjs stop java
node scripts/demo.mjs start java
```

Portas podem ser alteradas **antes de iniciar os serviços**:

```powershell
$env:CORE_PORT = '8080'
$env:PYTHON_PORT = '8000'
$env:FRONTEND_PORT = '5173'
$env:ARTICUNO_JAVA_HOME = 'C:\Users\USER\.jdks\ms-21.0.7'
$env:VIDEO_FILENAME = 'License_Plate_Detection_Test_1080p.mp4'
node scripts/demo.mjs start
```

As variáveis e portas são aplicadas no servidor, não compiladas como URLs `localhost` nos componentes React. Para configurações manuais do gateway, veja `frontend/.env.example`; não utilize prefixo `VITE_` para segredos.

### Iniciar cada serviço separadamente

Após a primeira configuração com o launcher, os comandos equivalentes abaixo permitem três terminais. Pare primeiro os processos automáticos. Execute cada bloco a partir da raiz. Não imprima `$demoConfig`, pois contém a chave privada.

**Terminal Java:**

```powershell
$demoConfig = Get-Content .demo/runtime.json | ConvertFrom-Json
$env:JAVA_HOME = 'C:\Users\USER\.jdks\ms-21.0.7'
$env:INTERNAL_API_KEY = $demoConfig.internalKey
$env:CORE_PORT = [string]$demoConfig.javaPort
$env:CORE_BIND_ADDRESS = '127.0.0.1'
$env:CORE_DB_PATH = Join-Path (Get-Location) '.demo/parking.db'
$env:CORE_LAYOUT_PATH = Join-Path (Get-Location) 'backend/parking-core-java/parking.example.json'
& "$env:JAVA_HOME\bin\java.exe" -jar backend/parking-core-java/target/parking-core-java-0.1.0-SNAPSHOT.jar
```

**Terminal Python:**

```powershell
$demoConfig = Get-Content .demo/runtime.json | ConvertFrom-Json
$env:INTERNAL_API_KEY = $demoConfig.internalKey
$env:JAVA_API_BASE_URL = "http://127.0.0.1:$($demoConfig.javaPort)"
$env:JAVA_EVENTS_ENDPOINT = '/api/v1/internal/vision-events'
$env:JAVA_IDEMPOTENCY_CONFIRMED = 'true'
$env:PYTHON_PORT = [string]$demoConfig.pythonPort
$env:CAMERA_CONFIG = Join-Path (Get-Location) 'backend/parking-vision-python/cameras.example.json'
$env:VIDEO_ROOT = Join-Path (Get-Location) 'backend/parking-vision-python/videos'
$env:CORS_ORIGINS = '[]'
Set-Location backend/parking-vision-python
./.venv/Scripts/python.exe -c "import os, uvicorn; from app.main import create_app; from app.config import Settings; uvicorn.run(create_app(Settings(_env_file=None)),host='127.0.0.1',port=int(os.environ['PYTHON_PORT']))"
```

**Terminal React/gateway:**

```powershell
$demoConfig = Get-Content .demo/runtime.json | ConvertFrom-Json
$env:INTERNAL_API_KEY = $demoConfig.internalKey
$env:JAVA_API_BASE_URL = "http://127.0.0.1:$($demoConfig.javaPort)"
$env:PYTHON_API_BASE_URL = "http://127.0.0.1:$($demoConfig.pythonPort)"
$env:FRONTEND_PORT = [string]$demoConfig.frontendPort
$env:DEMO_USERNAME = $demoConfig.username
$env:DEMO_PASSWORD = $demoConfig.password
$env:PUBLIC_ORIGIN = $demoConfig.publicOrigin
$env:VIDEO_FILENAME = 'License_Plate_Detection_Test_1080p.mp4'
Set-Location frontend
npm start
```

Use Ctrl+C em cada terminal para desligar processos iniciados manualmente. Eles não são gerenciados pelo launcher. Para desenvolvimento local, `npm run dev` usa Vite no mesmo gateway; publicação exige `npm run build` + `npm start`.

## Vídeo

O arquivo encontrado nesta máquina é `backend/parking-vision-python/videos/License_Plate_Detection_Test_1080p.mp4` (1920×1080, 1.800 frames). **`estacionamento.mp4` não existe aqui.** Para outra máquina, forneça um MP4 autorizado nessa pasta; nenhum vídeo acompanha o commit.

Em Câmeras, escolha o arquivo para a prévia do navegador e informe seu nome exato no servidor. A seleção não faz upload. A prévia não é sincronizada com a análise. A API retorna contagens reais de frames lidos/amostrados, sem percentual fictício. OCR permanece experimental, PR #13 não integrado: não há placas reconhecidas nem caixas de detecção fabricadas.

## Roteiro dos avaliadores

1. Abra `/admin` e `/totem/entrada` em abas separadas: consulte os setores reais.
2. Abra Câmeras; selecione `CAM_ENTRADA`, informe uma placa de teste brasileira ou deixe vazia, registre o evento **ASSISTED**, depois clique em **Enviar último evento ao Java**.
3. Mostre o recibo `APPLIED` e o `session_id`; confira a nova sessão e a ocupação do setor A nas outras abas, atualizadas automaticamente.
4. Selecione `CAM_A_B`; use a mesma placa ou o `session_id` retornado. Registre e envie. Mostre a mudança para B e a recomendação atualizada no totem.
5. Reenvie o mesmo evento: o identificador é preservado e a ocupação não aumenta novamente. Escolha o MP4, inicie a análise e mostre as contagens reais, separadas da operação assistida.

## Limites e segurança

- EXIT permanece bloqueado por política Java até autorização do JV-06. A interface não oferece saída como se estivesse autorizada. Não há pagamento, ticket, QR Code ou portal do motorista funcional neste escopo.
- O SQLite é a fonte de verdade das sessões. Um evento `LOCAL_VALIDATED`/`NOT_SENT` não significa sessão criada. `HTTP_ACKNOWLEDGED` indica sucesso HTTP; o recibo `APPLIED` comprova o efeito Java.
- A autenticação demonstrativa protege todas as telas e APIs do gateway. Só `/health` divulga uma resposta mínima sem autenticação. Não é uma solução de identidade/produção.
- Não exponha as portas 8000/8080 ou use túneis diretamente nos backends. A publicação deve apontar somente ao gateway autenticado, com HTTPS e `PUBLIC_ORIGIN` exata. Nunca publique Vite dev ou use `--host 0.0.0.0` para os backends.
- O estado local dos testes persiste: testes de ENTRY/PASSAGE deixam sessões de teste ativas. Não há encerramento administrativo artificial. Para uma demonstração limpa, pare os serviços e **preserve/renomeie** `.demo/parking.db` e eventuais arquivos SQLite auxiliares antes de reiniciar; não apague um banco em uso.

## Testes

```powershell
Push-Location frontend
npm test
npm run build
# Com os três serviços iniciados e MP4 autorizado disponível:
npm run test:e2e
Pop-Location
```

O teste de navegador usa Microsoft Edge instalado, os serviços reais e as credenciais locais. Interrompe/reinicia apenas o Java pertencente ao launcher, verifica persistência, cria sessões de teste e salva capturas em `.demo/screenshots/` (não commitadas). Não execute em ambiente compartilhado durante uma apresentação. Os testes unitários do gateway usam servidores HTTP locais controlados, separados desta integração real.

Resultados finais e eventual URL externa são registrados em `docs/MVP_VALIDATION.md`. Não considerar uma URL pública validada em outro dispositivo sem essa verificação explícita.

## HTTPS temporário (opcional)

O túnel publica somente o gateway autenticado. O endereço muda ao recriá-lo; os três serviços, o túnel e este computador precisam permanecer ligados. Não é publicação de produção. A senha demonstrativa permite ações administrativas; forneça-a somente aos avaliadores autorizados, por canal privado.

Nesta máquina, o executável oficial Cloudflare `2026.11.0` foi baixado em `.demo/tools/cloudflared.exe`, sem instalação global. SHA-256 conferido com o digest do release: `d5c1d82031da6253dcdcff64c944cd0fe063016edeb2e4fd088075fc9bd52d0a`. Para outra máquina, baixe o executável Windows amd64 do [release oficial](https://github.com/cloudflare/cloudflared/releases/tag/2026.11.0) e confira o digest antes de executar.

```powershell
# Com a aplicação local já validada:
./scripts/tunnel.ps1 start
# Mostra URL e exige as mesmas credenciais de .demo/access.json.
# Teste de HTTPS a partir desta máquina:
Push-Location frontend
node tests/public-smoke.mjs
Pop-Location
# Parar o túnel e restaurar o gateway para origem local:
./scripts/tunnel.ps1 stop
# Depois, se desejado, parar os três serviços:
./scripts/stop-demo.ps1
```

O script configura `PUBLIC_ORIGIN` com o hostname exato do túnel e reinicia apenas o gateway. Autenticação obrigatória, bloqueio de requisições de escrita de outras origens e lista explícita de rotas continuam ativos. O navegador público não acessa `localhost` nem recebe a chave interna. Verifique em outro dispositivo/rede: autenticação, painel, câmeras e totem. Se não carregar, use a demonstração local; não desative autenticação para contornar o problema.
