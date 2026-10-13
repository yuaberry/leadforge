# LeadForge — Diretrizes para agentes

Este repositório segue o workflow da Yua Devs. Antes de qualquer alteração:

1. Leia `IMPLEMENTATION_PLAN.md` (arquitetura, fases, invariáveis) e `docs/PROGRESS.md` (status atual).
2. Trabalhe **apenas na fase em andamento** — não pule etapas, não implemente fases futuras.
3. Antes de finalizar qualquer mudança, execute `bun run verify` (typecheck + lint + test + build). O projeto deve estar sempre compilável.

## Regras do projeto

- **ORM:** Drizzle (único). Schema em `src/server/db/schema.ts`; migrations em `drizzle/`.
- **UI:** Tailwind 3.4 + componentes shadcn **clássicos** (Radix) em `src/components/ui/`. O registry novo do shadcn (Base UI/oklch) é INCOMPATÍVEL com este setup — escreva componentes manualmente no padrão clássico quando precisar de novos.
- **Camadas:** `src/server/**` é server-only. Componentes React jamais importam de `src/server/`.
- **Secrets:** apenas em variáveis de ambiente (ver `.env.example`). Nunca em código, nunca no cliente. `SUPABASE_SERVICE_ROLE_KEY` nunca entra no bundle.
- **Compliance (invariáveis):** envio de mensagens passa SEMPRE pelo gate de elegibilidade; opt-out/suppression nunca é contornado; imports exigem proveniência; webhooks validam assinatura.
- **Multi-tenancy:** toda tabela de negócio carrega `organization_id` + RLS. Toda query passa por repositório que recebe o org id.
- **Idioma:** strings de UI em pt-BR.
- **Node:** ambiente Node 18.19 — Next pinado em 15.x. Não atualize o Next para 16+.

## Verificação

```bash
bun run verify   # typecheck + lint + test + build
```

Sem gate verde, a fase não está concluída.
