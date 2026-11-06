-- ============================================================
-- LEADFORGE — Bootstrap de Postgres local (compatível com Supabase)
-- ============================================================
-- Uso (Postgres 14+ local, ex.: Docker):
--   psql "$DATABASE_URL" -f scripts/local-postgres-bootstrap.sql
--   bun run db:migrate
--
-- POR QUE EXISTE:
--   As migrations do LeadForge usam recursos do Supabase que o Postgres
--   puro não tem:
--     1. roles `anon`, `authenticated`, `service_role`;
--     2. schema `auth` com auth.uid() / auth.jwt() / auth.role() / auth.email();
--     3. privilégios default (anon/authenticated/service_role) nas tabelas.
--   Sem esse shim, `bun run db:migrate` falha e a suíte RLS (dormante)
--   nunca ativa em ambiente local.
--
-- IMPORTANTE — fidelidade ao Supabase:
--   As funções abaixo reproduzem a semântica REAL do Supabase, inclusive o
--   cast `::jsonb` de `request.jwt.claims`. É por isso que este shim
--   consegue revelar bugs que um shim "leniente" esconderia
--   (ver src/server/db/tenant.ts — as claims precisam ser o PAYLOAD JSON
--   do JWT, não o token cru).
--
--   service_role: BYPASSRLS (equivale ao service_role do Supabase).
-- ============================================================

BEGIN;

-- ---------- Roles ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- ---------- Schema auth ----------
CREATE SCHEMA IF NOT EXISTS auth;

-- Reproduz o Supabase: request.jwt.claims é o PAYLOAD JSON do JWT.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.jwt() ->> 'role', current_setting('role', true));
$$;

CREATE OR REPLACE FUNCTION auth.email() RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() ->> 'email';
$$;

-- Tabela mínima equivalente ao auth.users do Supabase.
-- A migration 0001 cria um trigger AFTER INSERT ON auth.users que popula
-- public.users (perfil público). No Supabase essa tabela é gerenciada pelo
-- GoTrue; localmente criamos só o suficiente para o trigger funcionar.
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------- Privilégios ----------
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;

-- Default privileges: o Supabase faz o mesmo (tabelas novas ficam
-- acessíveis para anon/authenticated/service_role).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

COMMIT;

-- ---------- Feedback ----------
DO $$
BEGIN
  RAISE NOTICE 'LeadForge: bootstrap local aplicado (roles anon/authenticated/service_role + schema auth).';
END
$$;
