# LEADFORGE — Progresso de Execução

Cada fase só é marcada como concluída após `bun run verify` verde (typecheck + lint + test + build).

| Fase | Escopo | Status |
|---|---|---|
| 0 — Bootstrap | Next 15 + TS + Tailwind + shadcn clássico + Drizzle + Supabase client + env + Vitest + landing + auth + dashboard placeholder | ✅ Concluída |
| 1 — Tenancy & Auth | Orgs, membros, RBAC, RLS geral (todas as queries via withTenantDb sob `role=authenticated`), invites com link, onboarding do negócio digital, shell com sidebar/topbar, dashboard com dados reais | ✅ Concluída |
| 2 — Leads Core + Captura | Schema leads/companies/contacts, CSV import com proveniência, páginas de captura `/p/[slug]`, normalização + dedup | ⬜ Próxima |
| 3 — Product Hub + Commerce | Produtos (own/affiliate), webhooks Kiwify/Kirvano, tabela sales, attribution `/go/[token]` | ⬜ |
| 4 — Scoring + IA | Score weights, OpenRouter, análise (fatos/inferências/hipóteses), product match, message generator | ⬜ |
| 5 — CRM + Lucro + Metas | Pipeline kanban, deals, tasks, Profit Dashboard, Metas gamificadas | ⬜ |
| 6 — E-mail + Campanhas | ResendProvider, templates, Campaign Builder, suppression, unsubscribe, rate limits | ⬜ |
| 7 — WhatsApp + Inbox | WhatsAppCloudProvider, webhooks, opt-out, inbox unificada | ⬜ |
| 8 — Discovery | GooglePlacesProvider, busca avançada, pipeline de jobs | ⬜ |
| 9 — Analytics + Billing + Hardening | Analytics de conversão, Stripe prep, LGPD export/delete, audit, docs finais | ⬜ |

## Registro de gates

| Data | Fase | Gate | Observações |
|---|---|---|---|
| 2026-10-13 | 0 | verify ✅ | shadcn registry novo incompatível c/ Tailwind 3.4 (Node 18) — normalizado para Radix clássico. Vitest 5 exige Node 20+ — pinado em vitest@2.1.9. /dashboard marcado como force-dynamic. |
| 2026-10-13 | 1 | verify ✅ | Suíte RLS (10 testes) fica **dormante** até DATABASE_URL existir (skipIf) — ativa sozinha após `bun run db:migrate`. Mecanismo de query: withTenantDb (SET LOCAL ROLE authenticated + claims JWT) — RLS efetiva até para bugs de repository. Convites owner bloqueados na própria policy (anti-escalada). Sem FK users→auth.users para permitir testes com claims sintéticas (trigger garante integridade). |
