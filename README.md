<p align="center">
  <img src="public/logo.svg" alt="LeadForge" width="420" />
</p>

<h3 align="center">Find. Qualify. Personalize. Convert.</h3>

<p align="center">
  Plataforma SaaS de inteligência comercial e <strong>conquista financeira digital</strong>:<br />
  venda produtos autorais ou de afiliado em escala — com IA, campanhas de e-mail,<br />
  integração Kiwify/Kirvano, lucro em tempo real e metas gamificadas.
</p>

<p align="center">
  <a href="https://github.com/yuaberry/leadforge/actions/workflows/ci.yml"><img src="https://github.com/yuaberry/leadforge/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/yuaberry/leadforge/releases"><img src="https://img.shields.io/github/v/release/yuaberry/leadforge?color=8b5cf6&label=release" alt="Release" /></a>
  <img src="https://img.shields.io/badge/bun-1.4-orange" alt="Bun" />
  <img src="https://img.shields.io/badge/Next.js-15-3b82f6" alt="Next.js" />
  <img src="https://img.shields.io/badge/Supabase-RLS%20everywhere-22d3ee" alt="Supabase" />
  <img src="https://img.shields.io/badge/license-proprietary-red" alt="License" />
</p>

---

## 💡 Por que o LeadForge existe

Venda em massa não vem de spam frio — spam **quebra contas** (Kiwify, Kirvano,
WhatsApp, provedores de e-mail) e converte mal. Massa vem de:

```
Captura consent-first (páginas com LGPD)
  → Segmentação por IA (produto certo para a pessoa certa)
  → Copy personalizado (mensagem que fala a língua do lead)
  → Follow-up em sequência (onde a maioria das vendas acontece)
  → Attribution loop (repetir o que vende, matar o que não vende)
  → Venda via webhook → 💰 Lucro → 🎯 a meta enche
```

O LeadForge é a máquina completa — e cada venda aproximando você do que
sempre quis conquistar.

## ✨ Funcionalidades

| Módulo | O que faz |
|---|---|
| 🎯 **Captura pública** | Páginas `/p/[slug]` com consentimento LGPD registrado, honeypot, UTMs e entrega de isca digital |
| 📥 **Importação CSV** | Upload → mapeamento automático → validação → **proveniência obrigatória** → dedup + relatório |
| 🧠 **IA de vendas** | Análise com **fatos / inferências / hipóteses separados**, score de oportunidade, product match e mensagens (5 tons × e-mail/WhatsApp) |
| 📊 **Scoring auditável** | 8 sinais com pesos editáveis; histórico por execução; a IA nunca pontua direto |
| 📦 **Product Hub** | Autorais + afiliados × Kiwify, Kirvano, Hotmart, Eduzz, Braip, Monetizze |
| 🔗 **Attribution Engine** | Links `/go/[token]` com clique logado e UTM que atravessa o checkout até o webhook |
| 💰 **Lucro automático** | Vendas dos checkoffs entram sozinhas; despesas manuais; gráfico 6 meses; receita por produto |
| 🎯 **Metas & Sonhos** | Barra de progresso alimentada por **% de cada comissão**; imagem e link do produto; celebração |
| 📇 **CRM** | Pipeline kanban drag&drop (acessível), tarefas, timeline de atividades |
| ✉️ **Campanhas** | Steps com esperas, cap diário, janela de horário e **aprovação humana por padrão** |
| 🛡️ **Suppression** | Contato suprimido **nunca** recebe (invariável testado); bounce/complaint suprimem sozinhos |

## 🚀 Quickstart

```bash
git clone https://github.com/yuaberry/leadforge.git
cd leadforge
bun install
cp .env.example .env.local    # preencha Supabase URL, anon key e DATABASE_URL
bun run db:migrate
bun run dev                   # → http://localhost:3000
```

> Guia completo por sistema operacional em
> [SETUP-LINUX](docs/SETUP-LINUX.md) · [SETUP-MACOS](docs/SETUP-MACOS.md) ·
> [SETUP-WINDOWS](docs/SETUP-WINDOWS.md)
> — ou apenas `docker compose up --build` com o
> [Docker Compose](docker-compose.yml).

## 📥 Downloads

A release mais recente traz o pacote pronto para cada sistema:

| Sistema | Arquivo |
|---|---|
| 🐧 Linux | `leadforge-v0.6.0-linux.tar.gz` |
| 🍎 macOS | `leadforge-v0.6.0-macos.tar.gz` |
| 🪟 Windows | `leadforge-v0.6.0-windows.zip` |

Cada pacote contém o código-fonte completo + guia de instalação dedicado
(`SETUP.md.<so>`) na raiz.

👉 **https://github.com/yuaberry/leadforge/releases/latest**

## 🧱 Stack

| Camada | Tecnologia |
|---|---|
| Frontend | **Next.js 15** (App Router) · React 19 · TypeScript strict · Tailwind CSS 3.4 · shadcn/ui (Radix) |
| Backend | Route Handlers · Server Actions · Zod em todo contrato |
| Banco | **PostgreSQL (Supabase)** · Auth SSR · **RLS em 100% das tabelas** · Drizzle ORM + migrations |
| IA | `AIProvider` → OpenRouter (com modo demonstração determinístico sem chave) |
| E-mail | `EmailProvider` → Resend (com modo simulado honesto sem chave) |
| Checkouts | `CommerceProvider` → Kiwify · Kirvano (webhooks idempotentes) |
| Testes | Vitest — 84+ testes + suíte RLS de isolamento multi-tenant |

## 🔒 Segurança & Compliance (o diferencial)

- **Isolamento triplo**: RLS no banco + scoping por org nos repositórios +
  queries sob `role=authenticated` com claims JWT — bug de esquecer o
  `WHERE organization_id` retorna **vazio**, nunca dado de outro tenant
- **LGPD-first**: consentimento com data/hora, proveniência obrigatória em
  importações, base legal validada no gate de envio, opt-out em 1 clique,
  suppression imutável por webhook
- **Aprovação humana por padrão**: campanhas em modo manual nunca enviam
  sozinho — cada mensagem passa por revisão
- **APIs oficiais apenas**: sem scraping, sem bypass de rate limits, sem
  WhatsApp Web automatizado
- **Zero secrets no cliente** — verificado por scan do bundle

## 📁 Estrutura

```
src/
├── app/                  # rotas (App Router): (auth), (app), /p/[slug], /go/[token], /u/[token], /api
├── components/           # UI: shadcn clássico + domínio (leads, campaigns, crm, charts)
├── lib/                  # utils, formatação/normalização BR, constantes
├── server/               # SERVER-ONLY
│   ├── db/               # schema Drizzle + repositórios (sempre org-scoped)
│   ├── services/         # scoring, eligibility, campaign-runner, attribution, ingest
│   ├── providers/        # ai/ · email/ · commerce/ (abstrações substituíveis)
│   └── security/         # rate-limit in-process
├── validators/           # schemas Zod (contratos únicos client/server)
└── middleware.ts         # sessão + proteção de rotas
drizzle/                  # migrations SQL (tabelas + policies RLS por fase)
```

## 🧪 Qualidade

```bash
bun run verify   # typecheck + lint + test + build (o gate de cada fase)
```

O desenvolvimento é faseado com gate obrigatório — cada fase só é concluída
com `verify` verde. Ver o progresso completo em
[docs/PROGRESS.md](docs/PROGRESS.md) e o plano arquitetural em
[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## 🗺️ Roadmap

- ✅ F0 Bootstrap · F1 Multi-tenancy + Auth · F2 Leads + Captura ·
  F3 Produtos + Kiwify/Kirvano · F4 Scoring + IA · F5 CRM + Lucro + Metas ·
  F6 E-mail + Campanhas + Suppression
- ⏭️ F7 WhatsApp Business oficial + Inbox unificada
- ⏭️ F8 Discovery (Google Places API)
- ⏭️ F9 Analytics de conversão, billing (Stripe) e hardening final

## 📄 Licença

Código publicado para demonstração e avaliação — **uso comercial requer
licença**. Detalhes em [LICENSE](LICENSE). © 2026 LeadForge · Yua Devs.

---

<p align="center">Feito para quem quer <b>conquistar o que sempre quis</b>.</p>
