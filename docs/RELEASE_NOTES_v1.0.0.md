# LeadForge v1.0.0 — Find. Qualify. Personalize. Convert.

**Release estável.** Todas as 10 fases do plano entregues e o gate de qualidade
verde: 105 testes unitários + 17 de integração RLS, lint, typecheck, build,
smoke e scan de secrets — rodando no CI a cada push.

## Downloads por sistema operacional

| Sistema | Arquivo | Guia de instalação |
|---|---|---|
| 🐧 Linux | `leadforge-v1.0.0-linux.tar.gz` | [docs/SETUP-LINUX.md](docs/SETUP-LINUX.md) |
| 🍎 macOS | `leadforge-v1.0.0-macos.tar.gz` | [docs/SETUP-MACOS.md](docs/SETUP-MACOS.md) |
| 🪟 Windows | `leadforge-v1.0.0-windows.zip` | [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md) |

> Cada pacote contém o código-fonte completo + o guia `SETUP.md.<so>` na raiz.
> Alternativa universal: **Docker** (`docker-compose.yml`).

## O que é o LeadForge

Plataforma SaaS de inteligência comercial e conquista financeira digital:
venda produtos autorais ou de afiliado em escala — com IA, campanhas de
e-mail, WhatsApp oficial, integração Kiwify/Kirvano, lucro em tempo real e
metas gamificadas que se enchem com cada venda.

## Funcionalidades completas desta release

- **Multi-tenancy real** — RLS em 100% das tabelas; queries sob
  `role=authenticated` com claims JWT
- **Captura consent-first** (`/p/[slug]`) — LGPD registrada com data/hora, UTM e honeypot
- **Importação CSV** com proveniência obrigatória e deduplicação (5 chaves)
- **Discovery** — Google Places API (New) oficial + modo demonstração determinístico
- **Scoring configurável** — 8 sinais (incl. many_reviews com dados reais do Places), pesos editáveis, histórico auditável
- **AI Sales Assistant** — OpenRouter + modo demo: análise com fatos/inferências/hipóteses separados, product match, gerador de mensagens com link rastreado
- **Product Hub** — autorais + afiliados × Kiwify, Kirvano, Hotmart, Eduzz, Braip, Monetizze
- **Commerce Bridge** — webhooks Kiwify/Kirvano idempotentes (reentrega nunca duplica)
- **💰 Lucro automático** — venda → receita reconciliada → despesas manuais → gráfico 6 meses
- **🎯 Metas & Sonhos** — alocação automática de % da comissão, celebração ao atingir
- **CRM** — pipeline kanban drag&drop, tarefas, timeline
- **✉️ Campanhas** — steps com esperas, cap diário, janela horária, **aprovação humana por padrão**
- **🛡️ Suppression + unsubscribe** — HMAC 1-clique; bounce/complaint suprimem automaticamente
- **📱 WhatsApp oficial** — Cloud API com verificação de hub, opt-out por palavra-chave, inbox unificada (e-mail + WhatsApp)
- **📊 Analytics** — funil, taxa de resposta/reunião/conversão, ROI, entregabilidade por campanha
- **💳 Billing** — limites REAIS enforçados (leads, mensagens, IA, campanhas, convites)
- **⚖️ LGPD** — export CSV/JSON autenticado, direito ao esquecimento com cascata completa, auditoria completa

## Segurança e compliance

- Nenhuma escrita anônima no banco (captura/unsubscribe/webhooks = serviceDb
  documentado com Zod, HMAC, tokens, honeypot, rate limit)
- Scan de secrets no CI — zero credenciais no bundle do cliente
- Aprovação humana nunca removível (modo manual é o default das campanhas)
- APIs oficiais apenas — sem scraping, sem bypass de rate limits, sem WhatsApp Web

## Setup mínimo

```bash
bun install
cp .env.example .env.local   # Supabase URL + anon key + DATABASE_URL
bun run db:migrate
bun run dev                   # → http://localhost:3000
```

Documentação completa em `docs/` — [ARCHITECTURE](docs/ARCHITECTURE.md) ·
[DATABASE](docs/DATABASE.md) · [API](docs/API.md) · [SECURITY](docs/SECURITY.md) ·
[COMPLIANCE](docs/COMPLIANCE.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) ·
[ENVIRONMENT](docs/ENVIRONMENT.md).

---

© 2026 LeadForge · Yua Devs — uso comercial requer licença (ver LICENSE).
