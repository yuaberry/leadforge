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

---

## App Desktop (Windows / Linux / macOS)

O LeadForge tem um cliente desktop autocontido (Electron) que empacota o
servidor Next.js dentro do instalador — o usuário não precisa de Node, Bun
ou clonar o projeto. Basta instalar e informar a URL/chave do Supabase no
primeiro uso.

### Baixar

Releases com todos os instaladores:
https://github.com/yuaberry/leadforge/releases

| Sistema | Arquivo |
|---|---|
| Linux | `LeadForge-1.1.0.AppImage` ou `leadforge-desktop_1.1.0_amd64.deb` |
| Windows | `LeadForge Setup 1.1.0.exe` (ou `.zip` portável) |
| macOS | `LeadForge-1.1.0.dmg` (via CI na tag `v*`) |

### Primeira execução

1. Instale o pacote do seu SO.
2. Abra o LeadForge. Na primeira execução, aparece o wizard "Configurar".
3. Escolha **Servidor local** (roda o LeadForge no seu computador) ou
   **Servidor remoto** (conecta a uma instância hospedada).
4. No modo local, informe: URL do Supabase, chave anônima e DATABASE_URL
   (Project Settings → API e Database no painel Supabase).
5. Clique em "Iniciar LeadForge" — o servidor embutido sobe na porta 4210
   e a janela principal abre automaticamente.

As chaves ficam salas apenas neste computador (arquivo com permissão 0600);
nada é enviado ao Yua Devs. As migrations do banco devem estar aplicadas —
veja a seção VPS/Docker acima para aplicar as migrations.
