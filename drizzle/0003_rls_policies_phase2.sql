-- ============================================================
-- LEADFORGE — Phase 2: RLS do domínio de leads
-- ============================================================
-- Padrão: default deny (anon não vê nada); membros da org operam
-- tudo dentro da própria organização via is_org_member().
-- lead_tags é derivada: acesso via membership do lead.
-- Nota: a página pública /p/[slug] NÃO usa RLS anon — leitura e
-- escrita passam por Server Actions com serviceDb (validação Zod +
-- honeypot + rate limit), intencionalmente documentado.
-- ============================================================

-- ---------- lead_sources ----------

ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_sources_select ON public.lead_sources
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY lead_sources_insert ON public.lead_sources
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY lead_sources_update ON public.lead_sources
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY lead_sources_delete ON public.lead_sources
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- companies ----------

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY companies_select ON public.companies
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY companies_insert ON public.companies
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY companies_delete ON public.companies
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- contacts ----------

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY contacts_select ON public.contacts
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY contacts_insert ON public.contacts
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- leads ----------

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_select ON public.leads
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY leads_insert ON public.leads
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY leads_update ON public.leads
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY leads_delete ON public.leads
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- tags ----------

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY tags_select ON public.tags
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY tags_insert ON public.tags
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY tags_update ON public.tags
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY tags_delete ON public.tags
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- lead_tags (deriva acesso via lead da mesma org) ----------

ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY lead_tags_select ON public.lead_tags
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_tags.lead_id AND public.is_org_member(l.organization_id)
    )
  );
CREATE POLICY lead_tags_insert ON public.lead_tags
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_tags.lead_id AND public.is_org_member(l.organization_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.tags t
      WHERE t.id = lead_tags.tag_id AND public.is_org_member(t.organization_id)
    )
  );
CREATE POLICY lead_tags_delete ON public.lead_tags
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_tags.lead_id AND public.is_org_member(l.organization_id)
    )
  );

-- ---------- activities ----------

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY activities_select ON public.activities
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY activities_insert ON public.activities
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY activities_delete ON public.activities
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- capture_pages ----------

ALTER TABLE public.capture_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY capture_pages_select ON public.capture_pages
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY capture_pages_insert ON public.capture_pages
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY capture_pages_update ON public.capture_pages
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY capture_pages_delete ON public.capture_pages
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- form_submissions ----------

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_submissions_select ON public.form_submissions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY form_submissions_delete ON public.form_submissions
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));

-- ---------- import_batches ----------

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY import_batches_select ON public.import_batches
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
CREATE POLICY import_batches_insert ON public.import_batches
  FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY import_batches_update ON public.import_batches
  FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id));
CREATE POLICY import_batches_delete ON public.import_batches
  FOR DELETE TO authenticated USING (public.is_org_member(organization_id));
