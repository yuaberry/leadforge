# LeadForge — Instalação no Windows 10/11

> Requisitos: **Bun** e um projeto **Supabase** (gratuito). Tudo via PowerShell.

## 1. Instalar o Bun (PowerShell)

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
# feche e reabra o PowerShell, então:
bun --version
```

## 2. Preparar o projeto

```powershell
Expand-Archive -Path leadforge-v*.zip -DestinationPath .
cd leadforge-v*
bun install
Copy-Item .env.example .env.local
```

## 3. Criar o banco (Supabase)

1. Acesse **https://database.new** e crie um projeto gratuito.
2. Em **Authentication → Providers**, ative *Email*.
3. Em **Project Settings → API**, copie `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Em **Project Settings → Database**, copie a *connection string* (pooler,
   porta 5432) para `DATABASE_URL`.

Preencha esses 3 valores em `.env.local` (bloco de notas ou `notepad .env.local`).

## 4. Aplicar as migrations

```powershell
bun run db:migrate
```

## 5. Rodar

```powershell
bun run dev     # desenvolvimento → http://localhost:3000
# ou produção:
bun run build
bun run start
```

## Próximos passos

1. Crie sua conta em `/signup`
2. Complete o onboarding (negócio + meta dos sonhos)
3. Cadastre produtos e gere links rastreados em **Produtos**
4. Conecte o checkout em **Integrações** (Kiwify/Kirvano)
5. Crie uma página de captura em **Captura** e divulgue o link `/p/...`

> Alternativa com Docker (Docker Desktop para Windows): `docker compose up --build`
