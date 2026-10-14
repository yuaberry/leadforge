-- ============================================================
-- LEADFORGE — Phase 4: RLS de scoring, análises e rascunhos
-- ============================================================

-- ---------- lead_scores ----------

ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_scores_select ON public.lead_scores
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY lead_scores_insert ON public.lead_scores
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY lead_scores_delete ON public.lead_scores
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- lead_analyses ----------

ALTER TABLE public.lead_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_analyses_select ON public.lead_analyses
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY lead_analyses_insert ON public.lead_analyses
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY lead_analyses_delete ON public.lead_analyses
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- message_drafts ----------

ALTER TABLE public.message_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_drafts_select ON public.message_drafts
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY message_drafts_insert ON public.message_drafts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY message_drafts_update ON public.message_drafts
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY message_drafts_delete ON public.message_drafts
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
