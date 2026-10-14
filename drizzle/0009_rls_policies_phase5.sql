-- ============================================================
-- LEADFORGE — Phase 5: RLS de CRM, financeiro e metas
-- ============================================================
-- Paths privilegiados (serviceDb, DOCUMENTADOS):
--   - ingest de vendas reconcilia financial_transactions e cria
--     goal_contributions automáticas (chamado pelo webhook, sem claims).
-- Idempotência garantida por índices únicos (sale_id).
-- ============================================================

-- ---------- deals ----------

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY deals_select ON public.deals
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY deals_insert ON public.deals
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- tasks ----------

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- financial_transactions ----------

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY financial_select ON public.financial_transactions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY financial_insert ON public.financial_transactions
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY financial_delete ON public.financial_transactions
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- goals ----------

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_select ON public.goals
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY goals_insert ON public.goals
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY goals_update ON public.goals
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY goals_delete ON public.goals
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- goal_contributions ----------

ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY goal_contributions_select ON public.goal_contributions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY goal_contributions_insert ON public.goal_contributions
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY goal_contributions_delete ON public.goal_contributions
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
