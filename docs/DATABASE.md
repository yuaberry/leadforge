# LEADFORGE — Banco de Dados

PostgreSQL (Supabase) + Drizzle ORM. Migrations versionadas em `drizzle/`,
schema único em `src/server/db/schema.ts`.

## Como rodar

```bash
bun run db:generate   # gera SQL a partir do schema (offline)
bun run db:migrate    # aplica no DATABASE_URL
bunx drizzle-kit check
```

## Convenções

- `id uuid default gen_random_uuid()` — chaves primárias.
- `organization_id uuid not null` em **toda** tabela tenant-scoped (RLS obrigatória).
- Timestamps `timestamptz` em mode string (ISO).
- Policies por fase em `drizzle/*_rls_*.sql` (helpers SECURITY DEFINER em `0001`).
- Índices únicos parciais = deduplicação (veja abaixo).

## Tabelas por fase

### F1 — Tenancy
| Tabela | Papel |
|---|---|
| `users` | Perfil público (trigger `on_auth_user_created` espelha `auth.users`) |
| `organizations` | Tenant raiz; `settings` JSONB (categorias, canais, meta, pesos, alocação) |
| `organization_members` | RBAC: owner/admin/member/viewer (PK composta) |
| `invites` | Convites por link com token único; policy bloqueia papel owner |

### F2 — Leads
| Tabela | Papel |
|---|---|
| `companies` | Empresas normalizadas; **dedup**: `(org, source_id, external_id)`, `(org, domain)`, `(org, phone_normalized)`, `(org, email_normalized)`, `(org, name_address_hash)` — índices únicos parciais |
| `contacts` | Pessoas; dedup por `(org, email_normalized)` |
| `leads` | Unidade do pipeline (empresa × contato); LGPD: `legal_basis`, `consent_status`, `collected_at`, `opted_out_at`; dedup por pares únicos parciais |
| `lead_scores` | Histórico de pontuação com breakdown + snapshot dos pesos |
| `tags` / `lead_tags` | Segmentação (lead_tags deriva acesso via lead da org) |
| `activities` | Timeline de eventos (auditoria de negócio) |
| `lead_sources` | Proveniência rastreável (manual/csv/capture/discovery) |
| `capture_pages` | Páginas públicas `/p/[slug]` (slug único global) |
| `form_submissions` | Cada envio público com consentimento + UTM |
| `import_batches` | Lotes CSV com proveniência declarada + relatório |

### F3 — Comércio
| Tabela | Papel |
|---|---|
| `products` | Catálogo own/affiliate × plataformas |
| `commerce_integrations` | Webhook token por org (roteamento Kiwify/Kirvano) |
| `link_tokens` | Links rastreados `/go/[token]` |
| `link_clicks` | Log de cliques (IP/UA/referrer) |
| `sales` | Vendas; **idempotente** por `(org, platform, external_order_id)`; atribuição por `link_token_id` |

### F4 — IA
| Tabela | Papel |
|---|---|
| `lead_analyses` | Análises fatos/inferências/hipóteses; `recommended_product_id` validado contra o catálogo |
| `message_drafts` | Rascunhos com revisão humana antes do envio |

### F5 — CRM/Financeiro/Metas
| Tabela | Papel |
|---|---|
| `deals` | Oportunidades do kanban (forecast) |
| `tasks` | Tarefas do time |
| `financial_transactions` | Receitas (auto por venda) + despesas; `sale_id` único (reconciliação) |
| `goals` / `goal_contributions` | Metas; contribuição única por `(goal, sale)` |

### F6 — Campanhas
| Tabela | Papel |
|---|---|
| `campaigns` | Steps com caps, janela horária, modo manual/automated |
| `campaign_steps` | Posição única por campanha (sem loops) |
| `campaign_leads` | Estado por lead (PK única `campaign+lead`) |
| `messages` | Ciclo de vida completo do envio |
| `email_accounts` | Identidade from + webhook token |
| `suppression_list` | **Invariável**: emails/fones únicos por org; consultada por todo envio |

### F7 — WhatsApp/Inbox
| Tabela | Papel |
|---|---|
| `whatsapp_accounts` | Conta Cloud API por org (phone_number_id + token) |
| `conversations` | Inbox unificada (única por `lead+canal`) |
| `conversation_messages` | Mensagens in/out com status do provedor |

## RLS — resumo

- Default deny para `anon` (nenhuma policy).
- `authenticated` via `is_org_member(organization_id)`.
- Derivadas: `lead_tags` via lead da mesma org.
- Escrita anônima **não existe** — captura/unsubscribe/webhooks usam serviceDb
  com validação própria (Zod, HMAC, tokens, honeypot, rate limit).

## Triggers

- `on_auth_user_created` → cria `public.users`.
- `on_organization_created` → criador vira owner (não depende do app).
