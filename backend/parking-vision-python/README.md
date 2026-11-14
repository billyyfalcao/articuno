# Parking Vision — PY-01, PY-02 e PY-03

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
quanto o decoder permite, sem simular reprodução em tempo real. Por padrão,
frames são validados e contados; OCR e evidências são opcionais (abaixo).

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

## OCR experimental (PY-03)

Instale as dependências atualizadas com `pip install -r requirements-dev.txt`
usando o Python do ambiente virtual. O pacote pytesseract precisa também do
executável Tesseract e dos dados de idioma `eng`. No Windows, a instalação
testada foi `winget install --id UB-Mannheim.TesseractOCR --exact` (5.4.0).
Configure `TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe` no `.env`.
No Linux, instale Tesseract e idioma inglês pelo gerenciador da distribuição;
se estiver no PATH, o padrão `tesseract` funciona. Linux não foi executado aqui.

Exemplo no `/docs`, em `POST /api/v1/vision/analyze/start`:

```json
{"filename":"License_Plate_Detection_Test_1080p.mp4","sample_every":300,"ocr":true,"confidence_threshold":0.8,"roi":[615,850,100,40]}
```

A ROI opcional é um recorte manual `[x,y,largura,altura]` em pixels do frame
original; não é uma localização automática de placa. Sem ROI o motor tenta
texto esparso no frame inteiro. Uma ROI fixa pode deixar de conter a placa
quando o carro se move. Configure pelo frame real, não por uma leitura desejada.
Cada chamada ao motor tem timeout de 10 segundos. Falha de OCR é exposta em
`ocr_error` no status e não fabrica leitura nem interrompe a leitura do vídeo.

Consulte `GET /api/v1/vision/detections?limit=20` no `/docs` para visualizar
o texto bruto (inclusive estrangeiro/inválido), normalizado, confiança,
`frame_index` (base zero), tempo no vídeo, data com fuso, bounding box do texto
e motivo. Abra `evidence_url` no navegador para ver o frame original em JPEG.
Até 50 detecções/evidências ficam em memória; expiram ao iniciar outra análise,
ao sair da janela de 50 resultados ou ao reiniciar. Não há gravação automática
de imagens privadas nem mudança de frontend. Confiança é o menor score dos
tokens da linha dividido por 100, não uma probabilidade calibrada; zero com
`no_text` indica ausência de leitura.

`raw_text` preserva os tokens do motor, unidos por espaços na ordem da linha.
Normalização aplica somente maiúsculas e remoção de espaços/hífens. Não troca
O por 0, I por 1, não remove pontuação arbitrária nem escolhe caracteres para
encaixar no padrão. Formatos aceitos: `ABC1234` e `ABC1D23`.
Motivos: `no_text`, `invalid_brazilian_format`, `low_confidence` ou
`confirmation_required`. Passar no formato não comprova país, autenticidade
ou leitura correta. **Nenhum resultado gera evento automático nesta etapa**;
`automatic_event_allowed` permanece falso. O operador pode inspecionar a
evidência e confirmar fora deste módulo. Envio assistido pertence ao PY-06.

### Resultados: vídeo estrangeiro

Arquivo local fornecido: `License_Plate_Detection_Test_1080p.mp4`, não
`estacionamento.mp4`. OpenCV leu 1.800 frames a 30 fps. Ensaio via API com a
ROI acima e intervalo 300 terminou em `completed`, seis frames amostrados,
sem erro de OCR; consulta de evidência respondeu 200. Leituras por frame:

| Frame | Texto bruto | Confiança | Motivo |
|---|---|---|---|
| 0 | `acy` | 0.33 | invalid_brazilian_format |
| 300 | `——` | 0.24 | invalid_brazilian_format |
| 600 | vazio | 0 | no_text |
| 900 | vazio | 0 | no_text |
| 1200 | `““ANe` | 0.25 | invalid_brazilian_format |
| 1500 | `= Bl` | 0.10 | invalid_brazilian_format |

Esse ensaio comprova execução e rejeição honesta, **não reconhecimento correto
da placa real**. Uma inspeção adicional em 3 segundos também produziu leitura
incorreta e fraca. A ROI fixa e o tamanho/desfoque dos caracteres limitam o
resultado. Nenhum texto foi corrigido para parecer uma placa brasileira.

### Resultados: imagens brasileiras

Dois testes com motor real reconheceram `ABC1234` e `ABC1D23` em imagens
**sintéticas**, desenhadas pelo próprio teste com OpenCV (arte original,
sem fotografias externas). Não são observações do vídeo nem fotografias de
placas brasileiras. A execução de fotografias reais autorizadas segue pendente.

Para validar suas próprias fotos autorizadas, coloque imagens e um manifesto
JSON em `videos/` (pasta ignorada), com uma lista como:

```json
[{"file":"placa-autorizada.jpg","expected":"ABC1D23","authorized":true,"roi":[0,0,650,160]}]
```

Use o texto e recorte reais da fotografia. Defina `OCR_AUTHORIZED_MANIFEST`
com o caminho absoluto do manifesto e `TESSERACT_CMD` no ambiente do terminal;
execute `python -m pytest -q tests/test_authorized_images.py` pelo venv.
Os testes sintéticos também usam `TESSERACT_CMD`; sem motor configurado são
marcados como skipped, nunca como OCR comprovado. Sem manifesto, o teste de
fotografias reais é explicitamente skipped. Não versione fotos sem permissão.
