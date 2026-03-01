# Project Evolution: AdsMaster Dashboard

> **Objetivo**: Este arquivo serve como a memória central e o guia de arquitetura do projeto AdsMaster Dashboard. Ele deve ser atualizado a cada grande mudança para que o contexto nunca seja perdido.

---

## 📈 Evolução Atual (Status)

O sistema está na **Fase 2 (Dados Avançados)**. Saímos de um MVP que apenas lia cliques/custo do dia atual para um motor robusto de 30 dias com métricas de leilão.

### Últimas Mudanças Críticas (28/02/2026)

- **Motor GAQL**: Substituição do iterador de campanhas simples por consultas GAQL (`AdsApp.search`). Isso permitiu acessar colunas que não existem no objeto `Stats` comum (Target CPA, Impression Shares).
- **Pipeline Bulk (Lote)**: O Webhook agora processa um array de objetos. Isso é vital para carregar 30 dias de múltiplas campanhas sem estourar o timeout da Vercel ou o limite de conexões do Supabase.

---

## 💡 Lições Aprendidas (Knowledge Base)

- **CPA Alvo**: O Google Ads não expõe o `target_cpa` no objeto `Stats`. É obrigatório usar GAQL selecionando `campaign.target_cpa.target_cpa_micros`.
- **Filtros de Data**: Enviar apenas dados de "Hoje" impedia que os filtros de 7, 14 e 30 dias da UI funcionassem. A estratégia de "Push de 30 dias" garante que a UI esteja sempre populada.
- **Bypass de RLS**: Para webhooks, o uso da `SUPABASE_SERVICE_ROLE_KEY` no servidor Next.js é a forma mais limpa de realizar `upserts` sem lidar com políticas de autenticação complexas no momento da ingestão.

---

## 🛠️ Padrões Adquiridos (Guidelines)

- **Currency**: Sempre usar `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- **Cores (The 5-Level Heatmap)**:
    1. **Emerald 500**: ROI Brutal (>100%).
    2. **Emerald 400**: Lucro Normal.
    3. **Yellow 500**: ROI Drop (Alerta de margem <40%).
    4. **Orange 500**: Warning (Custo > 50% da comissão sem venda).
    5. **Rose 600**: Abort/Loss (Prejuízo ou Custo > 70% sem venda).
- **Upsert Matching**: A chave de unicidade no banco é `(account_id, campaign_name, date)`. Isso evita duplicatas se o script rodar várias vezes no mesmo dia.

---

## 📋 Histórico de Decisões

- **Decision 001**: Usar Next.js App Router para SSR rápido no Dashboard.
- **Decision 002**: Padronizar envio em lotes de 50 registros para estabilidade da API Vercel.

---
*Assinado: Antigravity AI - Registrando evolução do ecossistema.*
