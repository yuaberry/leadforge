-- ============================================================
-- LEADFORGE — Phase 6: RLS de campanhas, mensagens e suppression
-- ============================================================
-- Paths privilegiados (serviceDb, DOCUMENTADOS):
--   - Cron /api/cron/process-campaigns (CRON_SECRET)
--   - Webhook de eventos de e-mail (email_accounts.webhook_token)
--   - Cancelamento público /u/[token] (HMAC validado)
-- Todos escrevem com escopo manual por organization_id e respeitam
-- o gate de elegibilidade (invariável) antes de qualquer envio.
-- ============================================================

-- ---------- campaigns ----------

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_select ON public.campaigns
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY campaigns_insert ON public.campaigns
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaigns_update ON public.campaigns
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaigns_delete ON public.campaigns
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- campaign_steps ----------

ALTER TABLE public.campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_steps_select ON public.campaign_steps
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY campaign_steps_insert ON public.campaign_steps
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaign_steps_update ON public.campaign_steps
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaign_steps_delete ON public.campaign_steps
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- campaign_leads ----------

ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_leads_select ON public.campaign_leads
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY campaign_leads_insert ON public.campaign_leads
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaign_leads_update ON public.campaign_leads
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY campaign_leads_delete ON public.campaign_leads
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- messages ----------

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_select ON public.messages
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY messages_insert ON public.messages
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY messages_update ON public.messages
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));

-- ---------- email_accounts ----------

ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_accounts_select ON public.email_accounts
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY email_accounts_insert ON public.email_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY email_accounts_delete ON public.email_accounts
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- suppression_list ----------

ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY suppression_select ON public.suppression_list
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY suppression_insert ON public.suppression_list
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY suppression_update ON public.suppression_list
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY suppression_delete ON public.suppression_list
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
