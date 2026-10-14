-- ============================================================
-- LEADFORGE — Phase 3: RLS de produtos, vendas e atribuição
-- ============================================================
-- Padrão: membros operam tudo dentro da própria org.
-- Paths privilegiados (serviceDb, DOCUMENTADOS):
--   - /go/[token]: leitura de link_tokens + INSERT em link_clicks (público anônimo)
--   - /api/webhooks/commerce/[platform]: leitura de commerce_integrations
--     (por webhook_token) + INSERT/UPDATE de sales
-- Em ambos, a autenticação/validação acontece na camada de aplicação
-- (token de webhook, token de link, rate limit, Zod).
-- ============================================================

-- ---------- products ----------

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY products_delete ON public.products
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- commerce_integrations ----------

ALTER TABLE public.commerce_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY commerce_integrations_select ON public.commerce_integrations
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY commerce_integrations_insert ON public.commerce_integrations
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY commerce_integrations_delete ON public.commerce_integrations
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- link_tokens ----------

ALTER TABLE public.link_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY link_tokens_select ON public.link_tokens
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY link_tokens_insert ON public.link_tokens
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY link_tokens_update ON public.link_tokens
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY link_tokens_delete ON public.link_tokens
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- link_clicks (escrita apenas via /go/[token] serviceDb) ----------

ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY link_clicks_select ON public.link_clicks
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY link_clicks_delete ON public.link_clicks
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- sales ----------

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_select ON public.sales
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY sales_insert ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY sales_update ON public.sales
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY sales_delete ON public.sales
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
