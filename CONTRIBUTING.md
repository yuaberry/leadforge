# Contribuindo com o LeadForge

## Workflow

O desenvolvimento é **faseado com gates** ([docs/PROGRESS.md](docs/PROGRESS.md)):
toda mudança termina com o `verify` verde:

```bash
bun run verify   # typecheck + lint + test + build
```

Sem gate verde, a mudança não está pronta.

## Regras do projeto (src/AGENTS.md resumido)

- **ORM:** Drizzle (único). Schema em `src/server/db/schema.ts`; migrations em
  `drizzle/` — policies RLS acompanham toda tabela nova.
- **UI:** Tailwind 3.4 + shadcn **clássico** (Radix). O registry novo do shadcn
  (Base UI/oklch) é incompatível — escreva componentes manualmente no padrão
  clássico.
- **Camadas:** `src/server/**` é server-only; componentes React nunca importam
  de lá. Providers atrás de interfaces; SDKs externos isolados.
- **Multi-tenancy:** toda tabela de negócio carrega `organization_id` + RLS;
  toda query passa por repositório org-scoped.
- **Compliance (invariáveis):** envio passa SEMPRE pelo gate de elegibilidade;
  opt-out/suppression jamais contornados; imports exigem proveniência;
  webhooks validam assinatura/token.
- **Secrets:** apenas em env (`.env.example` é template). Nunca no código,
  nunca no cliente.
- **Idioma:** strings de UI em pt-BR.
- **Node:** Next pinado em 15.x (ambiente Node 18.19) — não atualizar para 16.

## Checklist de PR

- [ ] `bun run verify` verde
- [ ] Migração nova tem policies RLS correspondentes
- [ ] Testes cobrem a regra de negócio (pura) ou o invariável (integração)
- [ ] Nenhuma string de UI fora do pt-BR
- [ ] Zero secrets/credenciais no diff
- [ ] UI mobile-first verificada (sidebar oculta → bottom nav)

## Reporte de bugs e vulnerabilidades

Bugs: issue pública com passos de reprodução. Vulnerabilidades: use *security
advisory* privado do repositório.
