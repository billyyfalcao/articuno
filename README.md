# Articuno | Estacionamento Inteligente (Frontend)

Frontend do Sistema de Estacionamento Inteligente da equipe **Articuno**, contendo duas interfaces compartilhando o mesmo projeto, design tokens, componentes e camada de serviços:

- **Painel Administrativo:** `/admin`, `/admin/veiculos`, `/admin/setores`, `/admin/historico`
- **Interface Web do Motorista:** `/ticket/:token`, `/ticket/:token/localizacao`, `/ticket/:token/pagamento`

Stack: React + Vite + Tailwind CSS v4 + React Router + Lucide React.

---

## Requisitos e execução

```bash
npm.cmd install
npm.cmd run dev       # http://localhost:5173 (redireciona para /admin)
npm.cmd run build     # build de produção em dist/
npm.cmd run preview   # serve o build localmente
```

---

## Modo de demonstração e limitações do `localStorage`

- **Escopo do `localStorage`:** quando `VITE_USE_MOCKS=true`, o estado simulado (`src/mocks/store.js`) é persistido no `localStorage` do navegador sob a chave `articuno_parking_mock_state_v3`. Isso permite demonstrar a sincronização automática (~2,5s via polling + evento `storage`) entre o **Painel Administrativo** e a **Interface do Motorista** abertos em **abas ou janelas diferentes do mesmo navegador**.
- **Limitação entre dispositivos:** o `localStorage` é local a cada navegador/dispositivo. A sincronização entre dispositivos distintos (ex.: notebook do operador e smartphone físico do motorista) dependerá exclusivamente da integração com o backend oficial (`VITE_USE_MOCKS=false`).
- **Acesso administrativo sem autenticação:** permitido **somente** no modo de demonstração local (`VITE_DEMO_MODE=true` + `VITE_USE_MOCKS=true` + execução em `localhost`/dev server). **Não é uma proteção de produção.** A autenticação e a autorização reais são responsabilidade do backend.
- **Pagamento fictício:** o botão *"Simular pagamento"* realiza apenas a mudança de estado da sessão (`PAGA`) e inicia a janela de 15 minutos para saída, sem qualquer transação financeira real.
- **Restauração de dados:** o botão *"Restaurar dados"* no Laboratório de Simulação (`/admin`) interrompe o simulador automático, recria o estado inicial em `localStorage` e notifica imediatamente todas as abas abertas.

---

## Roteiro curto de demonstração para o Hackathon (2–3 minutos)

1. **Visão Geral (`/admin`):**
   - Apresente os indicadores principais: capacidade total (`315 vagas` nos setores A–G), ocupação estimada (`≈ 170 vagas`, identificando a carga inicial do turno), veículos presentes (`4 sessões`) e o mapa esquemático com faixas Verde, Amarelo e Vermelho e recomendações 70/30.
2. **Entrada do veículo e geração do Ticket (`/admin` → Laboratório de Simulação):**
   - Clique em **"Simular entrada"** (ou **"Sem placa (falha OCR)"**).
   - Mostre que a ocupação estimada do setor de entrada e o indicador de veículos presentes subiram imediatamente.
   - Clique no botão **"Abrir ticket do motorista"** exibido na faixa de confirmação para abrir `/ticket/:token` em uma nova aba.
3. **Movimentação em tempo real (Aba Admin ↔ Aba Motorista):**
   - Na aba do motorista, mostre o resumo do ticket e abra a aba **Localização** (`/ticket/:token/localizacao`).
   - De volta ao `/admin`, no bloco *2. Movimentar entre setores conectados*, mova a sessão do `Setor A` para o `Setor C`.
   - Observe a aba do motorista atualizar automaticamente (em até 2,5s) o último setor detectado para **Setor C** e destacá-lo no `ParkingMap`.
4. **Pagamento simulado e janela de 15 minutos (`/ticket/:token/pagamento`):**
   - Na aba do motorista, acesse **Pagamento** e clique em **"Simular pagamento"**.
   - Mostre o status mudando para **Paga**, o cronômetro regressivo de **15 minutos para saída** e, na aba `/admin`, o indicador **Pagas aguardando saída** atualizado automaticamente.
5. **Saída na cancela e auditoria (`/admin` e `/admin/historico`):**
   - No `/admin`, mova o veículo de volta para um setor conectado à saída (`Setor A` ou `B`) e clique em **"Simular saída na cancela"**.
   - Mostre que a aba do motorista passa a exibir *"Ticket não encontrado ou expirado"* (impedindo novas operações em sessão encerrada) e que toda a trilha ficou registrada em `/admin/historico`.
