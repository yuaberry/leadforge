-- ============================================================
-- LEADFORGE — Phase 7: RLS de WhatsApp e inbox
-- ============================================================
-- Paths privilegiados (serviceDb, DOCUMENTADOS):
--   - Webhook /api/webhooks/whatsapp?token=... (entrada/status/opt-out)
-- Escopo manual por organization_id em cada query do handler.
-- ============================================================

-- ---------- whatsapp_accounts ----------

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_accounts_select ON public.whatsapp_accounts
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY whatsapp_accounts_insert ON public.whatsapp_accounts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY whatsapp_accounts_update ON public.whatsapp_accounts
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY whatsapp_accounts_delete ON public.whatsapp_accounts
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- conversations ----------

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversations_select ON public.conversations
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY conversations_insert ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY conversations_update ON public.conversations
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY conversations_delete ON public.conversations
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- conversation_messages ----------

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_messages_select ON public.conversation_messages
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY conversation_messages_insert ON public.conversation_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY conversation_messages_update ON public.conversation_messages
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY conversation_messages_delete ON public.conversation_messages
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
