# Articuno | Sistema de Estacionamento Inteligente

Frontend integrado do **Sistema de Estacionamento Inteligente** desenvolvido pela equipe **Articuno** (planta de referência: **Capim Dourado Shopping — Setores A até G**).

O projeto reúne **três interfaces** na mesma aplicação React, compartilhando serviços, estado, componentes de domínio, mapa interativo e regras de negócio:

1. **Painel Administrativo (`/admin/*`):** monitoramento operacional em tempo real, indicadores (KPIs), mapa de calor dos setores A–G, gestão de sessões ativas/pagas, ajuste auditado de ocupação e histórico de eventos.
2. **Totem Digital de Entrada (`/totem/entrada`):** terminal touch-first dedicado ao motorista na cancela de entrada, com leitura simulada de placa (LPR/OCR), contingência para emissão manual sem placa, recomendação de setor (70%/30%), geração de ticket com QR Code exclusivo e impressão térmica de 80 mm.
3. **Interface Web do Motorista (`/ticket/:token/*`):** aplicação mobile-first acessada via leitura do QR Code do ticket para consulta de tempo de permanência, valor estimado em tempo real, localização aproximada do veículo no mapa e pagamento simulado com janela de 15 minutos para saída.

---

## 1. Tecnologias Utilizadas

- **React 19** (`react`, `react-dom`) — Arquitetura de componentes e hooks customizados.
- **Vite 8** — Bundler, code-splitting por rota (`lazy`) e servidor de desenvolvimento rápido.
- **React Router 8** (`react-router`) — Roteamento declarativo entre as três interfaces.
- **Tailwind CSS v4** (`@tailwindcss/vite`) — Design system utilitário, Container Queries (`@container`) no mapa interativo e estilos `@media print` dedicados para bobina térmica de 80 mm.
- **Lucide React** (`lucide-react`) — Ícones vetoriais acessíveis.
- **QRCode** (`qrcode`) — Geração vetorial síncrona de QR Codes em SVG de alto contraste.

---

## 2. Como Instalar e Executar o Projeto

### Pré-requisitos
- **Node.js** 20+ e **npm**.

### Comandos

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (http://localhost:5173)
npm run dev

# 3. Gerar build de produção (pasta dist/)
npm run build

# 4. Servir o build de produção localmente
npm run preview
```

> **Dica para PowerShell no Windows:** caso a política de execução (`ExecutionPolicy`) bloqueie `npm.ps1`, execute utilizando `npm.cmd install`, `npm.cmd run dev` e `npm.cmd run build`.

---

## 3. Como Acessar as Três Interfaces

| Interface | Rota | Descrição |
| :--- | :--- | :--- |
| **Painel Administrativo** | `/admin` | Dashboard geral, KPIs, mapa de calor A–G, recomendações e simulador operacional |
| **Veículos / Sessões (Admin)** | `/admin/veiculos` | Lista filtrável de sessões ativas, pagas e finalizadas + modal de detalhes |
| **Setores (Admin)** | `/admin/setores` | Gestão dos setores A–G e ajuste manual de ocupação com auditoria |
| **Histórico (Admin)** | `/admin/historico` | Trilha auditável de entradas, movimentações, pagamentos e ajustes |
| **Totem Digital de Entrada** | `/totem/entrada` | Autoatendimento na cancela, leitura de placa, emissão de ticket e cupom 80 mm |
| **Interface do Motorista** | `/ticket/:token` | Resumo do ticket digital, placa, permanência, tarifa estimada e prazo de saída |
| **Localização do Motorista** | `/ticket/:token/localizacao` | Mapa interativo destacando o último setor detectado para o veículo |
| **Pagamento do Motorista** | `/ticket/:token/pagamento` | Simulação de pagamento e ativação da janela de 15 minutos para saída |

### Tokens de demonstração pré-carregados (Seed Inicial)
- Sessão ativa com placa (`BRA2E19`, Setor C): `/ticket/JocC03Q-m_81Hr3XZ0IXvg`
- Sessão ativa sem placa identificada (Setor E): `/ticket/9kLmP2vXr4Tz8Wq1Bn6YcA`
- Sessão paga dentro do prazo de 15 min (`ART4C20`, Setor A): `/ticket/7vQpR5nZt2Yw9Lm4Kc8HdE`
- Sessão paga com prazo de 15 min expirado (`QWE9J81`, Setor B): `/ticket/3xBnM8kLp1Qr6Tv9Wz2YfG`

---

## 4. Como Utilizar o Simulador e Testar a Emissão de Tickets

### A. Simulador de Hardware no Totem Digital (`/totem/entrada`)
Disponível no topo da tela do totem quando `VITE_DEMO_MODE=true` e `VITE_USE_MOCKS=true`:
1. **Fluxo Automático (Leitura LPR/OCR bem-sucedida):**
   - Informe uma placa válida (padrão Mercosul `AAA0A00` ou antigo `AAA0000`) ou clique em **"Gerar placa"**.
   - Clique em **"Simular chegada"** (opcional, exibe o estado `Identificando placa`) e depois em **"Simular leitura OK"**.
   - O sistema valida a placa, verifica a disponibilidade dos setores de entrada (`A` e `B`), cria a sessão automaticamente via `sessionService`, gera o token de 128 bits (`base64url`), calcula o setor recomendado (70% vagas + 30% proximidade) e exibe o cupom térmico de **80 mm** com QR Code.
2. **Fluxo Alternativo (Falha na leitura OCR ou Câmera Indisponível):**
   - Clique em **"Simular falha na leitura OCR"** ou **"Simular câmera indisponível"**.
   - O totem exibe um aviso claro ao motorista e apresenta o botão grande **"Emitir ticket"** (sem exigir digitação de placa).
   - Ao tocar em **"Emitir ticket"**, uma sessão sem placa (`Não identificada`) é criada com a mesma segurança via token aleatório e QR Code.
3. **Teste de Impressão Térmica (80 mm) e Reimpressão:**
   - Clique em **"Imprimir / Salvar PDF"** no ticket emitido para acionar a folha de estilo `@media print` dimensionada em `80mm`.
   - Para testar contingência de papel/impressora, clique em **"Simular falha na impressão"** antes de emitir um ticket: a sessão é criada normalmente com status `Falha na impressão`. Em seguida, restaure a impressora e clique em **"Reimprimir mesmo ticket"** — o sistema reimprime o mesmo token sem duplicar a sessão.
4. **Proteções de Segurança e Anti-Duplicidade:**
   - Clique no atalho **"Duplicada (BRA2E19)"** e em **"Simular leitura OK"** para validar o bloqueio `HTTP 409` de veículo que já possui sessão ativa no pátio.
   - Clique no atalho **"Inválida (123-INV)"** para validar a rejeição de formato inválido antes de criar sessão.

### B. Laboratório de Simulação no Painel Administrativo (`/admin`)
- Permite simular **movimentações entre setores fisicamente conectados** (`SECTOR_CONNECTIONS`), **saídas na cancela** (validando pagamento e janela de 15 minutos), **ciclo automático contínuo** (~3,2s) e **restauração completa** dos dados (`Restaurar dados`).

---

## 5. Roteiro de Demonstração Completa para o Hackathon (~3 Minutos)

1. **Abertura — Totem Digital e Orientação (`/totem/entrada` — 45s):**
   - Abra `/totem/entrada` em uma aba e `/admin` em outra aba lado a lado.
   - Destaque o total de vagas disponíveis estimadas (`145 de 315`), o **Setor Sugerido (`Setor C`)** calculado pela regra **70% disponibilidade + 30% proximidade da entrada**, e o `ParkingMap` oficial do Capim Dourado Shopping (setores A até G).
2. **Entrada Automatizada e Emissão de Ticket (`/totem/entrada` — 45s):**
   - No Simulador do Totem, clique em **"Simular leitura OK"**.
   - Mostre que a sessão é criada instantaneamente, o cupom térmico de **80 mm** com QR Code é gerado e, na aba `/admin`, a ocupação estimada e o contador de sessões ativas sobem em tempo real.
   - Clique em **"Novo atendimento"**, simule uma **"Falha na leitura OCR"** e toque no botão grande **"Emitir ticket"** para demonstrar a contingência sem placa.
3. **Jornada do Motorista e Movimentação em Tempo Real (`/ticket/:token` — 45s):**
   - No ticket emitido no Totem, clique em **"Abrir Ticket do Motorista"**.
   - Mostre o tempo de permanência ao vivo e abra a aba **Localização**.
   - Na aba `/admin`, mova o veículo do setor de entrada (`B`) para o `Setor D` e depois `Setor C`. Mostre o mapa do motorista atualizando automaticamente o último setor detectado.
4. **Pagamento Simulado, Prazo de 15 Minutos e Saída (`/ticket/:token/pagamento` e `/admin` — 45s):**
   - Na aba do motorista, acesse **Pagamento** e clique em **"Simular pagamento"**.
   - Mostre o cronômetro regressivo de **15 minutos para saída**.
   - Na aba `/admin`, mova o veículo até o setor de saída (`Setor A` ou `B`) e clique em **"Simular saída na cancela"**.
   - Mostre que a sessão é encerrada, a vaga é liberada, o evento entra em `/admin/historico` e o link do ticket do motorista é imediatamente invalidado (`Ticket não encontrado ou expirado`).

---

## 6. Limitações Atuais do Protótipo (MVP)

- **Armazenamento compartilhado em `localStorage`:** no modo mock (`VITE_USE_MOCKS=true`), a sincronização em tempo real funciona entre abas/janelas do **mesmo navegador**. Para abrir o QR Code em outro dispositivo físico (ex.: smartphone externo), é necessário executar o projeto com o backend oficial compartilhado e configurar `VITE_PUBLIC_ORIGIN` com um endereço acessível na rede.
- **Impressão assistida via navegador (`window.print()`):** como não há impressora térmica física conectada via USB/Serial nesta etapa, o sistema renderiza o cupom de 80 mm via CSS `@media print`. A abertura da caixa de diálogo do navegador não confirma que o papel físico foi impresso, motivo pelo qual os estados de *Impressão solicitada* e *Impressão simulada* são diferenciados e permitem reimpressão idempotente.
- **Ocupação estimada por setor:** o sistema monitora a ocupação proporcional por setor (A–G) a partir de eventos de passagem e ajustes auditados, sem sensores em vagas individuais.
- **Pagamento e OCR simulados:** o reconhecimento de placa e a aprovação de pagamento são simulados para validação da arquitetura e da experiência de uso.

---

## 7. Arquitetura para Integração Futura (Backend, Câmeras e Impressoras)

- **Backend REST Oficial (`src/services/*.service.js` e `src/services/api/endpoints.js`):** basta definir `VITE_USE_MOCKS=false` e apontar `VITE_API_BASE_URL` para a API REST. Todos os serviços (`sectorService`, `recommendationService`, `sessionService`, `ticketService`, `dashboardService`, `historyService`) e DTO mappers já estão implementados.
- **Câmeras LPR/OCR Reais (`src/services/totemHardware.service.js` → `totemCameraAdapter`):** um WebSocket, Server-Sent Events (SSE) ou webhook local da câmera de entrada pode invocar diretamente `totemCameraAdapter.notifyVehicleApproach()`, `notifyPlateRead(plate)` e `notifyOcrFailure()` sem alterar a página do Totem.
- **Impressoras Térmicas ESC/POS (`src/services/totemHardware.service.js` → `totemPrinterAdapter`):** a função `printThermalTicket(ticket)` centraliza o envio do comprovante de 80 mm, permitindo substituir ou complementar `window.print()` por WebUSB, WebSerial ou serviço de spooler local.
