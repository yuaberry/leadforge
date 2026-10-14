# LeadForge — Instalação no Linux

> Requisitos: **Bun** e um projeto **Supabase** (gratuito). Node não é necessário.

## 1. Instalar o Bun

```bash
curl -fsSL https://bun.sh/install | bash
exec $SHELL   # recarrega o PATH
bun --version
```

## 2. Preparar o projeto

```bash
tar -xzf leadforge-v*.tar.gz
cd leadforge-v*/
bun install
cp .env.example .env.local
```

## 3. Criar o banco (Supabase)

1. Acesse **https://database.new** e crie um projeto gratuito.
2. Em **Authentication → Providers**, ative *Email*.
3. Em **Project Settings → API**, copie:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Em **Project Settings → Database**, copie a *connection string* (pooler, porta 5432)
   para `DATABASE_URL`.

Preencha esses 3 valores em `.env.local`.

## 4. Aplicar as migrations

```bash
bun run db:migrate
```

## 5. Rodar

```bash
bun run dev     # desenvolvimento → http://localhost:3000
# ou produção:
bun run build && bun run start
```

## 6. Verificação de qualidade (opcional)

```bash
bun run verify  # typecheck + lint + test + build
```

## Próximos passos

1. Crie sua conta em `/signup`
2. Complete o onboarding (negócio + meta dos sonhos)
3. Cadastre produtos e gere links rastreados em **Produtos**
4. Conecte o checkout em **Integrações** (Kiwify/Kirvano)
5. Crie uma página de captura em **Captura** e divulgue o link `/p/...`

> Alternativa com Docker: veja `docker-compose.yml`.
