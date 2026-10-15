# LEADFORGE — Deployment

## Opção 1 — Vercel + Supabase (recomendada)

1. **Supabase**: crie o projeto em [database.new](https://database.new).
   - Authentication → Providers → habilite *Email*.
   - Anote `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e
     `DATABASE_URL` (pooler sessão, porta 5432).
   - Aplique as migrations: `bun install && bun run db:migrate`.
2. **Vercel**: importe o repositório.
   - Framework: Next.js (detectado automaticamente).
   - Variables de Environment: cole tudo do `.env.example` que for usar
     (veja [ENVIRONMENT.md](ENVIRONMENT.md) para o que é opcional).
   - Domínio: adicione e use como `NEXT_PUBLIC_APP_URL`.
3. **Cron de campanhas**: agende
   `POST https://seu-dominio/api/cron/process-campaigns` com header
   `Authorization: Bearer <CRON_SECRET>` a cada 10-15 min
   (Vercel Cron: `vercel.json` ou dashboard).
4. **Webhooks** (cole as URLs nos painéis):
   - Kiwify/Kirvano: `https://seu-dominio/api/webhooks/commerce/kiwify?token=...`
     (o token aparece em Integrações).
   - Resend: `https://seu-dominio/api/webhooks/email/resend?token=...` (em
     Configurações → E-mail).
   - Meta for Business: `https://seu-dominio/api/webhooks/whatsapp?token=...`
     (em Configurações → WhatsApp).

## Opção 2 — VPS/Docker (qualquer SO)

```bash
cp .env.example .env.local   # preencha
docker compose up --build -d
```

Funciona no Docker Desktop de Linux, macOS e Windows. As migrations rodam no
host uma única vez (`bun run db:migrate` — requer Bun instalado ou use a
imagem: `docker compose run leadforge bun run db:migrate` após ajustar o
entrypoint).

## Build vs Runtime

- O **build não exige nenhuma variável** — o app compila e serve estados
  honestos de "configuração pendente" até as credenciais existirem.
- Postgres/Supabase é o único requisito obrigatório em runtime para qualquer
  área autenticada.

## Checklist de produção

- [ ] `DATABASE_URL` com pooler de sessão (não transaction para `withTenantDb`)
- [ ] RLS ativa (migrations aplicadas) — suíte: `bun run test` ativa RLS tests
- [ ] `CRON_SECRET` forte + cron agendado
- [ ] `LINK_TOKEN_SECRET` forte (unsubscribe HMAC)
- [ ] Domínio verificado na Resend + `from` da org configurado
- [ ] `WHATSAPP_VERIFY_TOKEN` igual ao cadastrado na Meta
- [ ] CI verde no repositório (typecheck/lint/test/build/smoke/scan)
