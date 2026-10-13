# LeadForge

> **Find. Qualify. Personalize. Convert.**
> Plataforma de inteligência comercial e conquista financeira digital: venda produtos autorais ou de afiliado em escala, com IA, campanhas de e-mail/WhatsApp, lucro em tempo real (Kiwify/Kirvano) e metas gamificadas.

## Stack

- **Next.js 15** (App Router) · React 19 · TypeScript strict
- **Tailwind CSS 3.4** + shadcn/ui (padrão clássico/Radix) · Lucide Icons
- **Supabase** (PostgreSQL + Auth + RLS)
- **Drizzle ORM** + drizzle-kit (migrations)
- **Zod** (validação) · **Vitest** (testes)
- **Bun** como gerenciador de pacotes

## Quickstart

```bash
bun install
cp .env.example .env.local   # preencha as credenciais do Supabase
bun run dev
```

Abra http://localhost:3000 — a landing, signup e login funcionam com um projeto Supabase configurado (veja o dashboard para instruções quando o `.env.local` não estiver pronto).

## Scripts

| Comando | Descrição |
|---|---|
| `bun run dev` | Servidor de desenvolvimento |
| `bun run build` | Build de produção |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript sem emit |
| `bun run test` | Vitest (unit/integration) |
| `bun run verify` | Gate de fase: typecheck + lint + test + build |
| `bun run db:generate` | Gera migrations Drizzle |
| `bun run db:migrate` | Aplica migrations |

## Documentação

- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) — arquitetura, fases e critérios de conclusão
- [docs/PROGRESS.md](./docs/PROGRESS.md) — status de execução por fase

## Princípios

- APIs oficiais apenas — sem scraping, sem bypass de limites, sem WhatsApp Web.
- LGPD-first — consentimento, proveniência, opt-out e suppression como invariáveis.
- Zero secrets no cliente.
- Projeto sempre compilável — toda fase passa por `bun run verify`.

---

© 2026 LeadForge · Yua Devs
