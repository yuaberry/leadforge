# LEADFORGE — Plano de Implementação (v2)

> **Find. Qualify. Personalize. Convert.**
> Plataforma de inteligência comercial e conquista financeira digital:
> venda em massa de produtos digitais (autorais e de afiliado) com alta conversão.

**Missão:** dar ao usuário total autonomia para destravar o financeiro através do digital — vender produtos de afiliado ou produtos autorais próprios, de qualquer categoria, com ganhos em escala — e ver cada venda aproximá-lo do que sempre quis conquistar.

**Status:** Planejamento v2 (refocado no objetivo real: venda em massa via checkouts digitais).
**Local:** `/home/llinux/leadforge`
**Ambiente validado:** Bun 1.4.2 · Node 18.19.1 · Linux Mint · 4 cores / 7.7GB RAM.

---

## 0. Objetivo (realinhado)

O LeadForge é uma **máquina de vendas digitais guiada por IA** para quem quer ganhos em massa:

1. **Vender produtos digitais em escala** — autorais ou de afiliado, qualquer categoria/nicho;
2. Integrado aos **checkouts digitais** — Kiwify, Kirvano (e depois Hotmart, Eduzz, Braip, Monetizze);
3. **Construir audiência de forma legal e em escala** — captura de leads (páginas + formulários com consentimento), descoberta de empresas (fontes autorizadas), importação com proveniência;
4. **Converter alto**: IA analisa cada lead, recomenda o produto certo, gera mensagem personalizada com **link de checkout rastreado**;
5. **Campanhas de e-mail/WhatsApp com sequência de follow-up** (onde está a conversão em massa) — via APIs oficiais, com aprovação humana;
6. **Fechar o ciclo do dinheiro**: cada venda via webhook entra sozinha → **Dashboard de Lucro** (comissões, custos, ROI por campanha) → **Metas/Sonhos gamificadas** ("30% de cada comissão vai para o notebook dos sonhos");
7. CRM completo para tratar quem respondeu (é a resposta que vira venda);
8. Analytics para descobrir **quais campanhas, produtos e canais realmente vendem** — e cortar o que não vende.

### O que é "venda em massa" aqui (definição honesta de engenharia)

Massa não vem de spam frio — spam **quebra contas** (Kiwify/Kirvano têm termos anti-spam) e converte mal. Massa vem de:

```
Captura em escala (páginas/isca digital + fontes autorizadas)
  + Segmentação por IA (produto certo para a pessoa certa)
  + Copy personalizado por IA (mensagem que fala a língua do lead)
  + Sequências de follow-up (steps com waits — a maioria das vendas acontece no follow-up)
  + Attribution loop (UTM + webhooks → repetir o que vende, matar o que não vende)
```

**A escala é do funil; a conversão é da relevância.** A plataforma entrega as duas.

### Princípios inegociáveis (inalterados)

- ❌ Sem scraping de Google Maps, sem bypass de CAPTCHA/rate-limit/banimento, sem WhatsApp Web automatizado.
- ✅ Somente APIs oficiais/provedores autorizados.
- ✅ LGPD desde a primeira migration — **ainda mais crítico agora**: público B2C é juridicamente mais sensível que B2B. Captura com consentimento registrado, proveniência obrigatória em todo import, opt-out/suppression como invariante.
- ✅ Suppression list é **invariante**: contato suprimido nunca recebe mensagem (código + testes).
- ✅ Zero secrets no cliente. Projeto sempre compilável (gates por fase).
- ✅ **Proteção de conta como feature**: os gates de compliance existem para o usuário NUNCA perder a conta Kiwify/Kirvano/WhatsApp por spam.

---

## 1. Decisões Técnicas (pinned — inalteradas)

| Área | Decisão | Justificativa |
|---|---|---|
| Framework | **Next.js 15.x** + React 19 | Node 18.19 (≥18.18) — Next 16 exige Node ≥20; pin 15.x |
| Linguagem | TypeScript **strict** | Contratos ponta a ponta |
| UI | Tailwind 3.4 + shadcn/ui + Lucide, dark-first | Estável com Node 18; identidade própria |
| Gráficos | Recharts 2.x | Simples com React 19 |
| ORM | **Drizzle ORM** + drizzle-kit | Único e definitivo; SQL-first, migrations versionadas |
| Banco | **PostgreSQL via Supabase** (cloud) + RLS em tudo | Sem Postgres local; isolamento multi-tenant nativo |
| Auth | Supabase Auth + `@supabase/ssr` | Sessions seguras no App Router |
| Multi-tenancy | `organizations` + RLS + scoping no app | SaaS-ready desde o dia 1 |
| IA | **AIProvider** → OpenRouter inicial | Troca de modelo sem tocar negócio |
| Filas | **QueueProvider** → BullMQ (com Redis) + **fallback in-process** | Sem Redis local; dev 100% funcional |
| E-mail | **EmailProvider** → Resend (depois SES/SMTP) | Substituível |
| WhatsApp | **WhatsAppProvider** → Cloud API oficial (Meta) | Único caminho permitido |
| **Checkouts** | **CommerceProvider** → Kiwify, Kirvano (depois Hotmart/Eduzz/Braip/Monetizze) | **NOVO** — webhooks de venda/reembolso com assinatura validada |
| Fontes de leads | **SourceProvider** → Capture (próprio), Google Places, CSV, Manual | **NOVO** — captura própria vira fonte primária |
| Validação | Zod | Contratos únicos |
| Testes | Vitest + Playwright (invariáveis) | Segurança testada, não assumida |
| Rate limiting | Token bucket em Postgres + limites por provedor | Respeita ToS |
| Cripto | AES-256-GCM app-layer para tokens de integração | Tokens nunca em texto plano |
| Package manager | Bun | Padrão do ambiente |

---

## 2. Arquitetura (evolução da v1)

```
┌──────────────────────────────────────────────────────────────────┐
│ UI — Next.js 15 App Router (dark, responsivo, shadcn)            │
│ (app)/ · (public)/ [landing + /p/[slug] captura + /go/[token]]  │
├──────────────────────────────────────────────────────────────────┤
│ API — Route Handlers                                             │
│  · /api/webhooks/commerce/[kiwify|kirvano|...]  ← vendas        │
│  · /api/webhooks/email · /api/webhooks/whatsapp · /stripe       │
│  · /api/internal/... (auth guard)                               │
├──────────────────────────────────────────────────────────────────┤
│ SERVER LAYER (src/server) — nunca no cliente                    │
│  auth/ · services/ (leads, products, offers, campaigns, crm,    │
│  attribution, finance, goals, analytics, compliance)            │
│  providers/ (ai/ · email/ · whatsapp/ · sources/ · commerce/)    │
│  jobs/ · security/ · db/ (schema, client, repositories)          │
├──────────────────────────────────────────────────────────────────┤
│ DATA — PostgreSQL/Supabase (RLS ON) · QUEUE — BullMQ⇄InProcess  │
├──────────────────────────────────────────────────────────────────┤
│ EXTERNAL: OpenRouter · Google Places · Resend/SES/SMTP ·        │
│ WhatsApp Cloud · Kiwify · Kirvano · Stripe (prep)              │
└──────────────────────────────────────────────────────────────────┘
```

### Fluxo de valor central (Offer Engine → Sale → Lucro → Meta)

```
Audiência (captura / discovery / import com proveniência)
  → Normalização + Dedup → Scoring → Segmentação
  → IA: análise do lead (fatos | inferências | hipóteses)
  → Product Match (produto autoral OU afiliado — catálogo do usuário)
  → Offer + Mensagem personalizada com LINK RASTREADO (/go/token)
  → [Revisão humana] → Campanha (steps + waits + follow-up)
  → Cliques → Checkout Kiwify/Kirvano (UTMs preservadas)
  → WEBHOOK venda.paga → sale registrada + atribuída à campanha
  → Respostas → Inbox → CRM → Pipeline → Won
  → 💰 Lucro Dashboard (comissão − custos − tráfego pago)
  → 🎯 Meta/Sonho: "R$ 1.240 lançados no notebook" — barra sobe
```

### Regras de dependência

- `app/` (server) importa `server/`; `components/` nunca importa `server/` direto.
- `server/providers/*` implementam interfaces; nenhum service importa SDK externo direto.
- Toda query passa por repositories que **sempre** recebem `organizationId`.
- Rotas públicas (`/p/[slug]`, `/go/[token]`) têm RLS própria: escrita permitida apenas via service role com validação Zod — sem exposição de tenant.

---

## 3. Novos Sistemas (delta v1 → v2)

### 3.1 Product Hub (substitui o catálogo de serviços)
Catálogo do usuário — **total autonomia**:
- `type`: `own` (autoral) | `affiliate` (afiliado)
- `platform`: kiwify | kirvano | hotmart | eduzz | braip | monetizze | custom
- `checkout_url`, `price`, `commission_percent`, `category`, `niche`, `image_url`
- Argumentos de venda, problemas resolvidos, benefícios, prova social, público-alvo (insumos da IA)
- A IA usa o catálogo para **recomendar o produto certo para cada lead** — cruzando perfil do lead × proposta do produto.

### 3.2 Commerce Bridge (webhooks de venda)
- Interface `CommerceProvider`: `verifySignature()`, `parseSaleEvent()`, `parseRefundEvent()`, `normalizeSale()`
- `KiwifyProvider`, `KirvanoProvider` (contratos Zed por payload, validação de assinatura)
- Eventos: venda aprovada, reembolso, chargeback → tabela `sales`
- Webhooks são **idempotentes** (external_order_id único por org)
- Dev sem chave de checkout: vendas podem ser **lançadas manualmente** (mesma tabela, `source: manual`)

### 3.3 Attribution Engine
- Toda mensagem gera um **token de link** (`/go/[token]`) → log de clique → redirect 302 ao checkout **preservando UTMs** (`utm_campaign={campaign}`, `utm_content={lead}`, `utm_term={product}`)
- Webhook de venda retorna UTMs → atribuição: venda → clique → mensagem → campanha → lead
- Resultado: **ROI real por campanha, produto, canal e mensagem** — o loop que separa o que vende do que só gasta

### 3.4 Lead Capture (aquisição consent-first em escala)
- Páginas públicas de captura `/p/[slug]` (headline, oferta/isca, formulário, consentimento LGPD explícito)
- `form_submissions` com proveniência completa (page, timestamp, IP, base legal) → cria lead com `consent_status: granted`
- Obrigatório no onboarding: **primeira página de captura antes de qualquer campanha** — a lista nasce legal
- Download de isca digital (e-book/planilha) via link pós-conversão

### 3.5 Profit Dashboard (💰 coração do app)
- Receita automática: `sales` (comissões de afiliado + vendas autorais) via webhooks + lançamentos manuais
- Custos: tráfego pago (Meta Ads, Google Ads), ferramentas, taxas de plataforma, outros
- Lucro líquido diário/mensal, ROI por campanha/produto/plataforma/nicho, MRR de recorrência
- Comparativos período (hoje/7/30/90/custom) e projeção com base no histórico

### 3.6 Metas & Sonhos gamificado (🎯 motor motivacional)
- Cada meta: nome, descrição, **image_url (link do anúncio/foto)**, **product_url (onde comprar)**, valor alvo, prioridade, data alvo, cor/ícone
- Progresso com alimentação automática: ex. **"30% de cada comissão → meta 'Notebook Gamer'"** (`goal_settings.auto_allocate_percent`)
- Cada venda dispara contribuição → barra sobe → celebração ao atingir (confete + registro no histórico)
- Painel "Falta R$ X para: [imagem da meta]" no dashboard principal
- Metas de qualquer natureza: equipamento, viagem, curso, carro, apartamento — "conquistar o que sempre quis"

---

## 4. Modelo de Dados (delta da v1 — tabelas novas/alteradas)

Convenções inalteradas (uuid pk, organization_id em tudo tenant-scoped, RLS ON, timestamps).

### 🆕 Produtos & Vendas (núcleo novo)
- `products` (type own|affiliate, platform, checkout_url, price, commission_percent, category, niche, image_url, selling_arguments jsonb, problems_solved jsonb, benefits jsonb, target_audience, status active|archived) — *substitui `services`*
- `sales` (product_id, platform, external_order_id **único por org**, customer_name/email_hash, amount, commission_amount, currency, status paid|refunded|chargedback|pending, utm jsonb, campaign_id?, lead_id?, link_click_id?, occurred_at, source: webhook|manual)
- `link_clicks` (token, message_id?, campaign_id, lead_id, product_id, destination_url, clicked_at, ip, user_agent)
- `link_tokens` (token, entity refs, expires_at, single_use) — geração criptográfica

### 🆕 Captura de Leads
- `capture_pages` (slug único global, headline, subheadline, body_html saneado, form_config jsonb, product_id?, lead_magnet_url, thankyou_url, consent_text, status published|draft, views/clicks counters)
- `form_submissions` (page_id, lead_id, data jsonb, legal_basis, consent_granted_at, ip, user_agent, utm jsonb)

### 🔁 Alteradas
- `financial_transactions` (type revenue|expense, category: sale|affiliate_commission|ad_spend|tools|fees|other, amount, sale_id?, campaign_id?, occurred_at, source: auto|manual)
- `goals` — inalterada da v1 + `celebrated_at`, `icon`, `color`
- `goal_contributions` — `source: manual|auto_sale`, `sale_id?`, `auto_percent_applied`
- `goal_settings` — `auto_allocate_percent`, `target_goal_id` (ex.: "todo lucro vai primeiro para a meta ativa")

### ✅ Mantém da v1 (sem mudanças)
organizations, organization_members, users, companies, contacts, leads (com campos LGPD), lead_sources, lead_scores, score_weights, lead_analyses, tags, lead_tags, offers, campaigns, campaign_steps, campaign_leads, messages, message_templates, conversations, conversation_messages, email_accounts, whatsapp_accounts, pipeline_stages, deals, tasks, activities, suppression_list, consents, audit_logs, integrations, api_keys, usage_records, subscriptions, job_logs, rate_limits.

---

## 5. Invariáveis de Segurança & Compliance (reforçadas para B2C)

1. **Suppression gate único**: `assertContactEligible()` é a única porta de envio — manual, campanha, bulk, follow-up, todos passam por ela.
2. **Opt-out keywords** (SAIR/PARAR/STOP/UNSUBSCRIBE) → suppression + evento + bloqueio permanente.
3. **B2C consent-first**: campanhas para leads B2C exigem `consent_status: granted` ou base legal explícita configurada (ex.: legítimo interesse B2B local). O sistema **recusa** enviar para base sem proveniência declarada.
4. **Import com proveniência**: CSV exige declaração de origem/base legal por lote; sem isso, o import fica bloqueado para envio (leads entram como `quarantined`).
5. Isolamento total entre tenants (RLS + testes).
6. Tokens de integração cifrados (AES-256-GCM); service role apenas server-side.
7. **Envio automatizado** exige todos os requisitos (canal + base legal + elegibilidade + caps + janela horária). Modo MANUAL nunca é removido.
8. Unsubscribe link obrigatório; bounce/complaint → suppression automática.
9. Rate limits respeitados — backoff + circuit breaker por provider.
10. **Webhooks assinados**: Kiwify/Kirvano/Stripe validados (secret timing-safe) antes de qualquer escrita.
11. Páginas públicas de captura com sanitização rigorosa de HTML (no XSS) e rate limit por IP.

---

## 6. Jobs & Filas (atualizados)

| Job | Responsabilidade |
|---|---|
| `lead.capture_inbound` | form_submission → normalização → dedup → scoring (novo) |
| `lead.discovery` / `normalization` / `deduplication` / `scoring` / `ai_analysis` | inalterados |
| `message.generation` | IA gera rascunho **com link tokenizado** |
| `email.send` / `whatsapp.send` | após gate de elegibilidade |
| `campaign.followup` | agenda próximo step (max steps — sem loop infinito) |
| `commerce.sale_ingest` | normaliza venda de webhook → financeiro → metas (novo) |
| `finance.recompute` | lucro + contribuições de metas (novo) |
| `analytics.update` | agrega métricas de período |

DLQ, retries exponenciais e `job_logs` inalterados. Idempotência em `commerce.sale_ingest` por `external_order_id`.

---

## 7. Estrutura de Diretórios (delta)

```
src/app/
├── (public)/              # landing, /p/[slug] (captura), /go/[token] (redirect)
├── (auth)/                # login, signup, callback
├── onboarding/
├── (app)/                 # shell autenticado
│   ├── dashboard/         # contadores + "falta R$X para sua meta"
│   ├── products/          # 🆕 Product Hub (autorais + afiliados)
│   ├── sales/             # 🆕 vendas recebidas via webhook
│   ├── profit/            # 💰 Dashboard de Lucro
│   ├── goals/             # 🎯 Metas & Sonhos
│   ├── leads/ · companies/ · import/ · export/
│   ├── campaigns/ · inbox/ · pipeline/ · tasks/
│   ├── analytics/ · ai/ · integrations/ · settings/ · billing/
└── api/
    ├── webhooks/commerce/[provider]/   # 🆕 kiwify, kirvano...
    ├── webhooks/email/ · whatsapp/ · stripe/
    └── internal/
src/server/providers/commerce/           # 🆕 CommerceProvider + kiwify/ + kirvano/
src/server/services/attribution.ts       # 🆕 tokens, cliques, atribuição
```

---

## 8. Fases de Execução (reordenadas para o objetivo real)

> Cada fase termina com `bun run verify` (typecheck + lint + test + build) verde.

### Phase 0 — Bootstrap técnico
Next 15 + TS strict + Tailwind + shadcn + dark theme, Drizzle, Supabase client, `.env.example`, middleware security, Vitest, landing com identidade LeadForge.
**Gate:** build/typecheck/lint/smoke ✓

### Phase 1 — Tenancy, Auth & Onboarding do negócio digital
Auth Supabase, orgs, RBAC, RLS geral. Onboarding v2: (1) criar org → (2) **"o que você vende?"** (afiliado/autoral, categorias, conectar Kiwify/Kirvano) → (3) canais → (4) IA → (5) **"o que você quer conquistar?"** (primeira meta com imagem/link) → (6) primeira página de captura.
**Gate:** testes RLS ✓

### Phase 2 — Leads Core + Captura pública
Schema leads/companies/contacts/tags. CSV import com proveniência obrigatória. **Lead Capture: `/p/[slug]` + formulário + consent → lead criado com consent granted.** Normalização + dedup (4 chaves). Lead profile.
**Gate:** teste E2E — formulário público cria lead consentido, sem duplicar ✓

### Phase 3 — 🆕 Product Hub + Commerce Bridge + Attribution
CRUD produtos (own/affiliate × plataformas). **Webhooks Kiwify/Kirvano** (assinatura validada, idempotente) → `sales`. Attribution: `/go/[token]` → clique → redirect com UTM. Venda manual (fallback dev).
**Gate:** teste — webhook simulado de venda paga cria sale + atribui campanha ✓

### Phase 4 — Scoring + IA + Product Match + Mensagens
Score weights editáveis. AIProvider/OpenRouter (mock para dev). Análise estruturada (fatos/inferências/hipóteses). **Product Match: lead × catálogo do usuário.** Offer Engine. Message Generator (tom × canal × objetivo) com link rastreado. Fluxo Analisar→Ofertar→Mensagem→Revisar→Enviar.
**Gate:** unit tests scoring/product-match (determinísticos) ✓

### Phase 5 — CRM + 💰 Lucro + 🎯 Metas
Pipeline kanban (drag&drop), deals, tasks, timeline. **Profit Dashboard** (vendas automáticas + custos + lucro + ROI por campanha/produto). **Metas gamificadas** (imagem por link, alocação automática de % da comissão, celebração). Widget "falta R$X" no dashboard.
**Gate:** venda do webhook alimenta lucro e sobe a meta automaticamente ✓

### Phase 6 — E-mail + Campanhas + Suppression
ResendProvider (depois SES/SMTP), templates, Campaign Builder (steps/waits/caps, modo manual/automated), unsubscribe, bounce/complaint → suppression, rate limits, bulk com gate de elegibilidade.
**Gate:** suprimido nunca recebe; opt-out exclui de campanhas futuras ✓

### Phase 7 — WhatsApp Oficial + Inbox
WhatsAppCloudProvider, webhook entrada/status, templates aprovados, opt-out por keyword. Inbox unificada (e-mail + WhatsApp) com resposta manual → CRM.
**Gate:** webhook simulado marca delivered/replied/opt-out ✓

### Phase 8 — Discovery (Google Places) — canal B2B/local
GooglePlacesProvider, busca avançada, pipeline discovery→normalize→dedup→score. **Agora é um canal de aquisição a mais** (para ofertas dirigidas a empresas/comércios locais), não o coração do app.
**Gate:** discovery com API key (mock sem chave) ✓

### Phase 9 — Analytics de conversão + Billing + Hardening + Docs
Analytics (response rate, meeting rate, conversão, ROI por campanha/produto/nicho). Stripe prep (planos). Export CSV/JSON. LGPD export/delete. Audit completo. Painel de jobs/DLQ. Docs finais. Revisão de segurança.
**Gate:** suite completa verde + scan de secrets no bundle ✓

---

## 9. Riscos (atualizados)

| Risco | Impacto | Mitigação |
|---|---|---|
| **B2C frio é juridicamente arriscado (LGPD)** | Multas, dano à marca | Captura consent-first como fonte primária; envio B2C exige consent; imports "quarantined" sem proveniência |
| **Spam derruba contas Kiwify/Kirvano/WhatsApp** | Perda do negócio inteiro | Gates de compliance como feature de proteção de conta; caps de frequência; opt-out instantâneo |
| Payloads de webhook divergem entre plataformas (Kiwify × Kirvano × Hotmart) | Vendas duplicadas/perdidas | CommerceProvider isolado por plataforma + Zod por payload + idempotência por external_order_id |
| Mudança de ToS das plataformas | Integração quebra | Providers isolados; webhooks tolerantes a campos novos |
| Sem chave de checkout em dev | Fase 3 bloqueada | Venda manual (`source: manual`) — mesmo schema, mesmo fluxo financeiro |
| Node 18.19 vs Next 16 | Build | Pin Next 15.x |
| Sem Redis/Postgres local | Dev | Supabase cloud + InProcessProvider |
| Custos de APIs (Places, OpenRouter, e-mail) | Conta surpresa | usage_records + limites + alertas |
| IA alucina dados da empresa/pessoa | Mensagem errada | Só fatos dos dados; fatos/inferências/hipóteses separados; revisão humana |
| Expectativa de "dinheiro fácil" | Frustração de produto | Analytics honesto: o app mostra o que converte; conversão vem de relevância + follow-up, e o produto dá o instrumento |

---

## 10. Variáveis de Ambiente (`.env.example` — esqueleto v2)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only
DATABASE_URL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
APP_ENCRYPTION_KEY=               # AES-256-GCM (tokens de integração)
LINK_TOKEN_SECRET=                # geração de /go/[token]

# AI (server-only)
OPENROUTER_API_KEY=
AI_MODEL=

# Sources
GOOGLE_PLACES_API_KEY=

# Email
RESEND_API_KEY=
EMAIL_FROM=

# WhatsApp Cloud API
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=

# Commerce (🆕)
KIWIFY_WEBHOOK_SECRET=
KIRVANO_WEBHOOK_SECRET=
KIWIFY_API_KEY=
KIRVANO_API_KEY=

# Queue (opcional em dev)
REDIS_URL=

# Stripe (prep)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

## 11. Critérios de Conclusão (Definition of Done)

Por fase: `bun run verify` verde + funcionalidade usável ponta a ponta.

Global:
- [ ] Fluxo completo: captura/import → lead → score → IA → product match → oferta → mensagem com link rastreado → revisão → campanha → clique → venda (webhook Kiwify/Kirvano) → lucro → meta
- [ ] Venda registrada automaticamente alimenta Profit Dashboard e a Meta (barra sobe)
- [ ] Teste: contato suprimido nunca recebe mensagem
- [ ] Teste: opt-out nunca entra em nova campanha
- [ ] Teste: tenant A nunca vê tenant B
- [ ] Teste: webhook de venda sem assinatura válida é rejeitado; venda duplicada é idempotente
- [ ] Teste: zero secrets no bundle cliente
- [ ] Import sem proveniência nunca vira campanha (quarantine)
- [ ] Integrações com estados reais; audit log completo; docs + `.env.example`

---

*Plano v2 — agente ARCHITECT Yua Devs. Reconcilia o posicionamento real (venda em massa de produtos digitais via Kiwify/Kirvano, lucro e metas gamificadas) mantendo 100% da arquitetura técnica, providers e compliance da v1. Execução fase a fase com builder/reviewer.*
