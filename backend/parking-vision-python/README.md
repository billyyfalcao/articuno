# Parking Vision — PY-01

Serviço independente do Java. Implementa apenas configuração, CORS e
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
Somente GET é permitido por CORS nesta etapa; cookies não são habilitados.
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
