# LEADFORGE — Segurança

## Modelo de ameaças e mitigações

| Ameaça | Mitigação |
|---|---|
| Vazamento cross-tenant | RLS em 100% das tabelas + queries sob `role=authenticated` com claims JWT (`withTenantDb`) + scoping explícito por org nos repositórios |
| Escalada de privilégio | Convites com papel `owner` bloqueados **na policy**; admin não toca em owners; org nunca fica sem owner (guards app + RLS) |
| Spam de formulários públicos | Zod estrito + honeypot + rate limit por IP (5/min por página, 10/min global) |
| Webhook forjado | Token único por integração/conta (32 bytes base64url); `phone_number_id`/plataforma validados contra a conta roteada; unsubscribe por HMAC timing-safe |
| Bounce/complaint ignorados | Suppression automática no evento — endereço nunca mais é tentado |
| Secrets no cliente | Nenhum `*_KEY` vaza: scan de bundle no CI (`scripts/scan-secrets.sh`); service role apenas server-side |
| CSRF em server actions | Next.js valida `Origin` por padrão em actions/POSTs |
| XSS | React escapa por padrão; nenhum `dangerouslySetInnerHTML`; imagens por URL arbitrária não passam por `next/image` (allowlist impossível — decisão documentada) |
| Força bruta de tokens | Rate limit por IP em webhooks; tokens ≥ 16 chars; HMAC com comparação timing-safe |
| Mass mailing acidental | Daily cap por campanha + limite mensal do plano + janela horária + aprovação humana por padrão |

## Segredos

- **Todos** via env (`.env.local` nunca versionado; `.env.example` é template).
- `SUPABASE_SERVICE_ROLE_KEY`: apenas workers server-side.
- `OPENROUTER_API_KEY`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`,
  `WHATSAPP_TOKEN`, `CRON_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `LINK_TOKEN_SECRET`:
  server-only.
- Scan automatizado no CI falha o build com padrões reais (gho_, sk-, whsec_, re_, AIza, JWTs).

## Headers de segurança

`next.config.ts` aplica em todas as rotas: `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` restritivo, `poweredByHeader: false`.

## Rate limits

In-process (token bucket) para captura pública e webhooks (upgrade para
Postgres planejado — IMPLEMENTATION_PLAN §27). Limites de provedores
(Google, Meta, Resend, OpenRouter) são **respeitados, jamais contornados**
(429 vira mensagem honesta).

## Verificação contínua

- CI: typecheck + lint + 100+ testes + build + smoke + secret scan.
- Suíte RLS (com `DATABASE_URL`) valida isolamento de tenants em 17 cenários,
  incluindo os invariáveis: suprimido nunca recebe; opt-out exclui de campanhas;
  webhook de venda é idempotente.

## Reporte de vulnerabilidades

Abra uma issue privada/security advisory no repositório. Não abra issue
pública com detalhes exploráveis.
