# LEADFORGE — Arquitetura

> Visão técnica completa. Para o plano de fases, veja [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md).

## Visão geral

O LeadForge é um SaaS multi-tenant de inteligência comercial e conquista financeira
digital, construído como **uma aplicação Next.js 15 (App Router)** sobre
**PostgreSQL/Supabase com Row Level Security em todas as tabelas**.

```
┌────────────────────────────────────────────────────────────────────┐
│  UI — Next.js 15 (React 19, Tailwind 3.4, shadcn/Radix)           │
│  src/app · src/components                                          │
├────────────────────────────────────────────────────────────────────┤
│  API — Route Handlers (webhooks de checkout/e-mail/WhatsApp, cron) │
├────────────────────────────────────────────────────────────────────┤
│  SERVER LAYER (src/server — nunca importada pelo cliente)         │
│  auth/            sessão Supabase, contexto de org, guards         │
│  services/        regras de negócio puras e orquestradores          │
│  providers/       ai/ · email/ · whatsapp/ · commerce/ · sources/   │
│  db/              schema Drizzle, repositórios org-scoped          │
│  security/        rate-limit in-process                             │
├────────────────────────────────────────────────────────────────────┤
│  DATA — PostgreSQL (Supabase) · RLS em 100% das tabelas tenant     │
├────────────────────────────────────────────────────────────────────┤
│  EXTERNAL — OpenRouter · Google Places · Resend · Cloud API Meta · │
│             Kiwify · Kirvano · Stripe (prep)                       │
└────────────────────────────────────────────────────────────────────┘
```

## Princípios estruturais

1. **Camadas rígidas** — `components/` nunca importa `server/`; `server/providers/*`
   implementam interfaces; nenhum service importa SDK externo diretamente.
2. **Toda query de negócio é org-scoped** — repositórios sempre recebem
   `organizationId`; a RLS é a segunda barreira.
3. **Contratos únicos com Zod** — `src/validators` define os mesmos schemas para
   cliente e servidor.
4. **Providers substituíveis** — trocar OpenRouter por outro LLM, Resend por SES,
   Kiwify por Hotmart = implementar a interface, zero mudança no negócio.
5. **Modo demonstração honesto** — sem credenciais, providers mock determinísticos
   mantêm o produto inteiro navegável e testável.

## Multi-tenancy e RLS

- `organizations` + `organization_members` são a raiz do isolamento.
- **Toda** tabela de negócio carrega `organization_id` com policy baseada em
  `is_org_member()` (SECURITY DEFINER, search_path pinado).
- Queries autenticadas rodam via **`withTenantDb()`**: transação com
  `SET LOCAL ROLE authenticated` + `request.jwt.claims` do usuário — um bug de
  repository (ex.: `WHERE` esquecido) retorna **vazio**, nunca dado de outro tenant.
- Paths privilegiados (webhooks, cron, captura pública, unsubscribe) usam a
  conexão de serviço **documentadamente**, com escopo manual por
  `organization_id` em cada query e autenticação por token único por integração.

## Fluxo de valor central

```
Captura /p/[slug] · Import CSV (proveniência) · Discovery (Places API)
  → Normalização → Deduplicação (external_id · domínio · fone · e-mail · hash)
  → Scoring (8 sinais, pesos editáveis, histórico auditável)
  → IA (análise fatos/inferências/hipóteses · product match · mensagem)
  → Campanha (steps/waits · caps · janela horária · aprovação humana)
  → Envio (e-mail/WhatsApp oficiais · suppression gate em TODO path)
  → Respostas (WhatsApp webhook → inbox) → CRM (pipeline/kanban/tarefas)
  → Venda (webhook Kiwify/Kirvano idempotente) → 💰 Lucro → 🎯 Meta
```

## Invariáveis enforçadas

1. **Suppression**: `decideEligibility()` é a única porta de envio — inclusive na
   resposta manual da inbox. Testado em unidade + integração.
2. **Opt-out**: link HMAC + palavra-chave no WhatsApp → suppression `all` +
   `opted_out_at` — nunca removível senão por ação consciente auditada.
3. **Aprovação humana**: campanhas em modo `manual` geram `pending_approval` e
   nunca enviam sozinhas.
4. **Idempotência**: vendas por `(org, plataforma, order_id)`; mensagens
   WhatsApp por `provider_message_id`; contribuições de meta por `(goal, sale)`.
5. **Zero secrets no cliente** — verificado por scan no CI.

## Filas

Fase 6+ usa execução orientada por request (`processCampaignBatch`) + cron
(`CRON_SECRET`). A abstração de fila (BullMQ + fallback in-process) está
planejada para volumes maiores — ver IMPLEMENTATION_PLAN.md §6.

## Testes

- **Unitários/puros (Vitest)** — scoring, eligibility, normalização, CSV,
  parsers de providers, metas, billing: rodam sem banco.
- **Integração RLS (dormante)** — `DATABASE_URL` presente → validam isolamento
  de tenants, dedup, gate de envio, webhook de venda→lucro→meta, discovery.
- **CI (GitHub Actions)** — typecheck + lint + test + build + smoke + scan.
