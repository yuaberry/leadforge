-- ============================================================
-- LEADFORGE — Fix: criação de organização sob RLS
-- ============================================================
-- PROBLEMA:
--   A policy de SELECT em public.organizations só permite ver a org se o
--   usuário já é membro. O vínculo de membro é criado por um trigger AFTER
--   INSERT (handle_new_organization), que roda DEPOIS do statement.
--
--   Consequência: `INSERT INTO organizations ... RETURNING id` (o fluxo real
--   do onboarding) é bloqueado pelo RLS — o RETURNING é avaliado antes do
--   trigger, quando o usuário ainda não é membro:
--       ERROR: new row violates row-level security policy for table "organizations"
--   Na prática: NENHUM usuário conseguia criar a própria organização.
--
-- SOLUÇÃO:
--   1. Coluna created_by (autor da org) preenchida por trigger BEFORE INSERT.
--   2. A policy de SELECT passa a enxergar a própria org de criação.
--      (A policy de INSERT continua exigindo usuário autenticado.)
-- ============================================================

-- ---------- Coluna do autor ----------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS organizations_created_by_idx ON public.organizations(created_by);
--> statement-breakpoint

-- ---------- Trigger BEFORE INSERT: registra o autor ----------
CREATE OR REPLACE FUNCTION public.handle_new_organization_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

DROP TRIGGER IF EXISTS on_organization_created_by ON public.organizations;
--> statement-breakpoint

CREATE TRIGGER on_organization_created_by
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization_created_by();
--> statement-breakpoint

-- ---------- Policy de SELECT: autor enxerga a própria org ----------
DROP POLICY IF EXISTS organizations_select ON public.organizations;
--> statement-breakpoint

CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id) OR created_by = auth.uid());
--> statement-breakpoint

-- ---------- Policy de UPDATE: idem (autor mantém acesso) ----------
DROP POLICY IF EXISTS organizations_update ON public.organizations;
--> statement-breakpoint

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(id) OR created_by = auth.uid())
  WITH CHECK (public.is_org_member(id) OR created_by = auth.uid());
