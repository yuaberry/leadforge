# LEADFORGE — Variáveis de Ambiente

Copie `.env.example` → `.env.local`. **Nada** é versionado. O app compila sem
nenhuma variável (estados honestos de "configuração pendente"); cada integração
liga conforme você adiciona a chave.

## Obrigatórias (para área autenticada funcionar de verdade)

| Variável | Onde pegar | Sem ela |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Auth não funciona |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem | idem |
| `DATABASE_URL` | Supabase → Database (pooler sessão, porta 5432) | Páginas autenticadas exibem orientação |

## Server-only (nunca com prefixo NEXT_PUBLIC)

| Variável | Liga o quê |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Workers administrativos (não requerida para operação normal) |
| `APP_ENCRYPTION_KEY` | Cifração futura de tokens de integração por org |
| `LINK_TOKEN_SECRET` | **HMAC do link de unsubscribe** (fallback: APP_ENCRYPTION_KEY) |
| `CRON_SECRET` | Bearer do endpoint `/api/cron/process-campaigns` |
| `OPENROUTER_API_KEY` + `AI_MODEL` | IA real (sem: modo demonstração determinístico) |
| `GOOGLE_PLACES_API_KEY` | Discovery real (sem: mock determinístico) |
| `RESEND_API_KEY` + `EMAIL_FROM` | E-mail real (sem: envios simulados marcados) |
| `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` | Cloud API real (sem: modo simulado) |
| `WHATSAPP_VERIFY_TOKEN` | Verificação do webhook da Meta (qual valor você definir) |
| `KIWIFY_WEBHOOK_SECRET` / `KIRVANO_WEBHOOK_SECRET` | Reservado para verificação de assinatura nativa quando usada |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Billing Stripe (prep — limites já rodam sem) |

## Opcionais

| Variável | Default | Observação |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Use o domínio real em produção (links de unsubscribe/rastreamento) |
| `REDIS_URL` | — | Fila BullMQ quando necessário (hoje: fallback in-process) |
| `AI_MODEL` | `openai/gpt-4o-mini` | Qualquer modelo da OpenRouter |

## Hierarquia de "modo demonstração"

Sem a chave do provedor, o LeadForge **não quebra** — ele opera com dados
fictícios determinísticos claramente marcados na UI ("modo demonstração"):
IA, e-mail, WhatsApp e Google Places. Você valida o fluxo completo hoje e
liga cada um quando quiser.

---

## Ambiente local de testes (offline, sem credenciais reais)

Para rodar E2E e suíte RLS sem um projeto Supabase provisionado, use o
harness local de testes:

| Componente | Porta | Como sobe |
|---|---|---|
| Postgres 16 (container `lf-pg-test`) | 54329 | `docker run --name lf-pg-test -e POSTGRES_PASSWORD=lfpass -p 54329:5432 -d postgres:16` |
| Mock Supabase Auth (GoTrue-compatível) | 54399 | `bun run scripts/mock-supabase-auth.ts` (node:http, registra em `auth.users`) |

Bootstrap do banco: `scripts/local-postgres-bootstrap.sql` (cria schema,
tabelas, RLS, políticas e trigger `organizations.created_by`).

Arquivo de ambiente de teste (não versionado, fonte em `/tmp/lf-test.env`):
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key
SUPABASE_SERVICE_ROLE_KEY=local-service-role-key
DATABASE_URL=postgresql://postgres:lfpass@localhost:54329/leadforge
NEXT_PUBLIC_APP_URL=http://localhost:4210
APP_ENCRYPTION_KEY=bG9jYWwtbG9jYWwtbG9jYWwtbG9jYWwxMjM=
LINK_TOKEN_SECRET=local-link-token-secret-0123456789abcdef
CRON_SECRET=local-cron-secret
```
Use: `set -a; . /tmp/lf-test.env; set +a` (ou `source`) antes de build/start/test.

E2E dispatch (navegador real, Chrome via Playwright 1.49.1, sem download de Chromium):
```
E2E_BASE_URL=http://localhost:4210 bun run scripts/e2e-dispatch.ts
```
Exercita: signup → onboarding (org sob RLS) → produto → lead → campanha
manual (pending_approval → aprovar → sent) → campanha automatizada (sent)
→ gate de supressão (suprimido = 0 mensagens). Requer `DATABASE_URL` e o
servidor Next rodando (porta 4210 por padrão).

Vitest (suíte RLS): precisa de `DATABASE_URL` definido ou os testes
integração ficam dormentes (skipIf):
```
bun run test   # com DATABASE_URL no ambiente
```

**Segurança:** nunca commite credenciais reais. O `.env.local` de produção
não entra no repositório; use apenas as variáveis locais de teste acima.
