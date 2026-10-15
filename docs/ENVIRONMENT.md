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
