# LeadForge v0.6.0 — "O dinheiro entra sozinho"

Primeira release pública do **LeadForge** — plataforma de inteligência
comercial e conquista financeira digital: encontre audiência, qualifique com
IA, gere mensagens personalizadas e veja cada venda alimentar o lucro e as
suas metas. Venda produtos autorais ou de afiliado via **Kiwify** e
**Kirvano**, com webhooks oficiais e atribuição real por link rastreado.

## Downloads por sistema operacional

| Sistema | Arquivo | Guia de instalação |
|---|---|---|
| Linux | `leadforge-v0.6.0-linux.tar.gz` | [docs/SETUP-LINUX.md](docs/SETUP-LINUX.md) |
| macOS | `leadforge-v0.6.0-macos.tar.gz` | [docs/SETUP-MACOS.md](docs/SETUP-MACOS.md) |
| Windows | `leadforge-v0.6.0-windows.zip` | [docs/SETUP-WINDOWS.md](docs/SETUP-WINDOWS.md) |

> Cada pacote contém o código-fonte completo + o guia `SETUP.md.<so>` na raiz.
> Alternativa universal: **Docker** (`docker-compose.yml`).

## O que tem nesta release

- ✅ **Multi-tenancy real** — RLS em todas as tabelas; queries rodam sob
  `role=authenticated` com claims JWT (bug de scoping não vaza dados)
- ✅ **Leads** — captura pública com consentimento LGPD (`/p/[slug]`),
  importação CSV com proveniência declarada, normalização e deduplicação
  (5 chaves + índices únicos)
- ✅ **Product Hub** — produtos autorais e de afiliado × 7 plataformas
- ✅ **Commerce Bridge** — webhooks **Kiwify/Kirvano** idempotentes
  (reentrega não duplica), venda → receita → meta automaticamente
- ✅ **Attribution Engine** — links rastreados `/go/[token]` com log de
  cliques e UTMs preservadas até o webhook
- ✅ **Scoring configurável** — 8 sinais com pesos editáveis e histórico
  auditável; IA entra como sinal, nunca pontua direto
- ✅ **AI Sales Assistant** — OpenRouter (ou modo demonstração sem chave):
  análise com fatos/inferências/hipóteses separados, product match e
  gerador de mensagens com tom × canal
- ✅ **CRM** — pipeline kanban (drag&drop + acessível), tarefas, atividades
- ✅ **💰 Lucro** — receitas automáticas dos checkouts − despesas manuais,
  gráficos de 6 meses e receita por produto
- ✅ **🎯 Metas & Sonhos** — barra de progresso alimentada por % de cada
  venda paga (alocação automática), imagem/link do produto, celebração
- ✅ **Campanhas de e-mail** — steps com esperas, cap diário, janela de
  horário e **aprovação humana por padrão**
- ✅ **Suppression list + unsubscribe** — contato suprimido **nunca**
  recebe (provado em testes); bounce/complaint suprimem automaticamente

## Segurança e compliance (destaques)

- LGPD: consentimento registrado com data/hora, proveniência obrigatória em
  imports, base legal validada no gate de envio, opt-out em 1 clique
- Zero secrets no cliente; tokens de integração cifrados em trânsito e
  roteados por token único por organização
- APIs oficiais apenas — sem scraping, sem bypass de limites, sem
  WhatsApp Web automatizado

## Requisitos

- **Bun** (gerenciador de pacotes e runtime) — não requer Node
- Projeto **Supabase** gratuito (PostgreSQL + Auth + RLS)
- Opcional: Resend (e-mail real), OpenRouter (IA real), integração
  Kiwify/Kirvano (vendas automáticas)

## Configuração mínima

```bash
bun install
cp .env.example .env.local   # NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, DATABASE_URL
bun run db:migrate
bun run dev                   # → http://localhost:3000
```

Sem credenciais o app roda e mostra orientações honestas de configuração —
nada quebra, nada mente.
