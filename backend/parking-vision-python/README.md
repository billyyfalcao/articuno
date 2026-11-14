# Parking Vision — PY-01 e PY-02

Modelos e preparação local de eventos do PY-04: [EVENTS.md](EVENTS.md).
Simulador assistido local, endpoints e roteiro do PY-06: [SIMULATOR.md](SIMULATOR.md).
Transporte HTTP opcional e mock do PY-05: [HTTP_CLIENT.md](HTTP_CLIENT.md).

Serviço independente do Java. Implementa processamento local de MP4, configuração, CORS e
`GET /health`, que retorna HTTP 200 com `{"status":"ok"}`. Saúde indica
que o processo responde; não verifica Java, câmera, OCR ou banco.

## Requisitos

Python 3.13 (validado com 3.13.7), acesso ao PyPI para instalação e porta
8000 disponível. Execute os comandos a partir da raiz do repositório.

## Windows (PowerShell)

```powershell
cd backend/parking-vision-python
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
.venv/Scripts/python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Não é necessário ativar o ambiente virtual nem alterar a política do PowerShell.
Em outro terminal, consulte `Invoke-RestMethod http://127.0.0.1:8000/health`.

## Linux

```bash
cd backend/parking-vision-python
python3.13 -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

Consulte `curl --fail http://127.0.0.1:8000/health`. Se o sistema não fornecer
venv, instale o pacote correspondente à versão do Python usando o gerenciador
da sua distribuição. Encerre o servidor com Ctrl+C. Swagger: `/docs`.

## Configuração

`CORS_ORIGINS`: array JSON de origens HTTP(S) exatas. Padrão:
`["http://localhost:5173","http://127.0.0.1:5173"]`.
Para outra porta do frontend, ajuste explicitamente a lista. `[]` desabilita
acesso cross-origin. Não aceita `*`, caminhos, credenciais, query ou fragmento.
GET e POST são permitidos por CORS nesta etapa; cookies não são habilitados.
CORS é uma política do navegador, não autenticação.

Variáveis do processo têm precedência sobre o `.env` localizado na pasta do
serviço; depois vêm os padrões. Campos desconhecidos no `.env` são rejeitados.
Configuração inválida impede a inicialização e mostra uma mensagem sanitizada,
sem imprimir valores. Não coloque chaves Java neste serviço nesta etapa.
Nunca versione `.env`, `.venv`, vídeos privados ou credenciais.

## Testes

Windows: `.venv/Scripts/python.exe -m pytest -q`

Linux: `.venv/bin/python -m pytest -q`

Execute dentro da pasta do serviço. Cobertura: health, preflight CORS permitido
e negado, configuração inválida sem exposição do valor, leitura de `.env` e
precedência do ambiente. Para instalação sem ferramentas de teste, use
`requirements.txt`. Não há frontend nem integração Java nesta Issue.

## Vídeos locais (PY-02)

Crie a pasta `videos` dentro deste serviço e copie para ela um MP4 que você
tenha autorização para usar. Alternativamente, configure `VIDEO_ROOT` no `.env`
com o caminho absoluto da pasta (Windows: `C:/parking-videos`; Linux:
`/home/usuario/parking-videos`). Não há download ou upload de vídeos pela API.
MP4 está ignorado no Git; não adicione vídeos privados ou grandes à força.

Execute o Uvicorn com **um único worker**, em `127.0.0.1`, como nos comandos
acima. O estado e a exclusão de análises simultâneas são locais ao processo,
não compartilhados entre workers. Não exponha estes controles sem autenticação
em uma rede pública. Uma origem CORS autorizada não substitui autenticação.

Na documentação interativa `/docs`, execute:

1. `POST /api/v1/vision/analyze/start` com
   `{"filename":"amostra.mp4","sample_every":5}`.
2. `GET /api/v1/vision/status` para consultar o andamento.
3. `POST /api/v1/vision/analyze/stop` sem corpo para solicitar parada.

`filename` aceita apenas o nome de um arquivo diretamente na pasta autorizada:
URLs, caminhos absolutos, subpastas e links que escapam dela são rejeitados.
`sample_every` é inteiro de 1 a 10000 (padrão 5): seleciona frames de índice
0, 5, 10 etc. Não representa frames por segundo. A leitura ocorre tão rápido
quanto o decoder permite, sem simular reprodução em tempo real. Frames são
validados e contados, não armazenados nem submetidos a OCR.

O início responde 202; a abertura/decodificação ocorre na thread de trabalho.
Arquivo ausente retorna 404, entrada inválida 422 e análise concorrente 409.
Vídeo corrompido ou codec não suportado aparece como `error` no status.
Estados: `idle`, `running`, `stopping`, `stopped`, `completed`, `error`.
O status inclui nome do arquivo, intervalo de amostragem, `frames_read`,
`frames_sampled` e erro sanitizado. Ao terminar ou parar, pode iniciar de novo;
contadores são reiniciados. Reiniciar o servidor perde o estado.

Parada é cooperativa: o decoder termina a leitura atual antes de liberar a
captura. Enquanto isso, o estado é `stopping` e outra análise é recusada.
No encerramento, o serviço solicita parada e aguarda até cinco segundos.
Uma chamada nativa de codec travada não pode ser interrompida pela thread;
nesse caso é necessário encerrar o processo. Não há pausa/retomada neste MVP.

Os testes geram um MP4 sintético de 12 frames em diretório temporário, sem
arquivo binário versionado. Também verificam erro de vídeo corrompido,
amostragem, reinício, parada, liberação da captura, exclusividade e health
durante processamento. Mensagem `moov atom not found` do decoder é esperada
no caso de teste do arquivo corrompido.
