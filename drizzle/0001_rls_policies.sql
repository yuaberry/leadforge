-- ============================================================
-- LEADFORGE — Phase 1: Row Level Security, helpers e triggers
-- ============================================================
-- Princípios:
--   1. Default deny: nenhuma policy para `anon`; tudo exige `authenticated`.
--   2. Isolamento por organização via membership (organization_members).
--   3. Helpers SECURITY DEFINER com search_path pinado (anti-hijack).
--   4. Triggers garantem invariantes (owner na criação da org, perfil no signup).
-- ============================================================

-- ---------- Helper functions (SECURITY DEFINER, search_path pinado) ----------

CREATE OR REPLACE FUNCTION public.is_org_member(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = target_org
      AND m.user_id = auth.uid()
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_org_admin(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = target_org
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  );
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = target_org
      AND m.user_id = auth.uid()
      AND m.role = 'owner'
  );
$$;
--> statement-breakpoint

-- Usado na policy de primeiro membro (criação de org). SECURITY DEFINER é
-- essencial: sem ele, a subquery seria filtrada pela própria RLS da tabela e
-- "org sem membros visíveis" ≠ "org sem membros".
CREATE OR REPLACE FUNCTION public.org_has_no_members(target_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.organization_id = target_org
  );
$$;
--> statement-breakpoint

-- E-mail do usuário autenticado (a partir do JWT da sessão).
CREATE OR REPLACE FUNCTION public.auth_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(auth.jwt() ->> 'email');
$$;

-- ---------- users ----------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Perfil próprio OU perfis de membros da mesma organização.
CREATE POLICY users_select ON public.users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members m1
      JOIN public.organization_members m2
        ON m1.organization_id = m2.organization_id
      WHERE m2.user_id = public.users.id
        AND m1.user_id = auth.uid()
    )
  );
--> statement-breakpoint

CREATE POLICY users_insert_self ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
--> statement-breakpoint

CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------- organizations ----------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));
--> statement-breakpoint

-- Qualquer usuário autenticado pode criar a própria org;
-- o trigger on_organization_created o promove a owner.
CREATE POLICY organizations_insert ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
--> statement-breakpoint

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));
--> statement-breakpoint

CREATE POLICY organizations_delete ON public.organizations
  FOR DELETE TO authenticated
  USING (public.is_org_owner(id));

-- ---------- organization_members ----------

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY members_select ON public.organization_members
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));
--> statement-breakpoint

-- Inserção permitida em 3 caminhos:
--   1. Primeiro membro = criador owner (app insere org; trigger cuida no fluxo normal,
--      mas o caminho direto também é permitido e validado).
--   2. Aceite de convite válido (pending, não expirado, e-mail compatível, mesmo papel).
--   3. Admin/owner adicionando membros diretamente.
CREATE POLICY members_insert ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      user_id = auth.uid()
      AND role = 'owner'
      AND public.org_has_no_members(organization_id)
    )
    OR (
      user_id = auth.uid()
      AND role <> 'owner'
      AND EXISTS (
        SELECT 1 FROM public.invites i
        WHERE i.organization_id = organization_members.organization_id
          AND i.status = 'pending'
          AND (i.expires_at IS NULL OR i.expires_at > now())
          AND (i.email IS NULL OR i.email = public.auth_user_email())
          AND i.role = role
      )
    )
    OR public.is_org_admin(organization_id)
  );
--> statement-breakpoint

-- Admins gerenciam papéis de não-owners; owners gerenciam tudo.
-- (WITH CHECK avalia a LINHA NOVA — admin não pode promover a owner.)
CREATE POLICY members_update ON public.organization_members
  FOR UPDATE TO authenticated
  USING (
    (role <> 'owner' AND public.is_org_admin(organization_id))
    OR public.is_org_owner(organization_id)
  )
  WITH CHECK (
    (role <> 'owner' AND public.is_org_admin(organization_id))
    OR public.is_org_owner(organization_id)
  );
--> statement-breakpoint

-- Admins removem não-owners; owners removem qualquer um; qualquer um pode sair (se não for owner).
CREATE POLICY members_delete ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    (role <> 'owner' AND public.is_org_admin(organization_id))
    OR public.is_org_owner(organization_id)
    OR (user_id = auth.uid() AND role <> 'owner')
  );

-- ---------- invites ----------

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- Membros da org vêem todos os convites; convidados vêem convites pendentes endereçados a eles.
CREATE POLICY invites_select ON public.invites
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(organization_id)
    OR (
      status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
      AND (email IS NULL OR email = public.auth_user_email())
    )
  );
--> statement-breakpoint

CREATE POLICY invites_insert ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_admin(organization_id)
    AND created_by = auth.uid()
    AND role <> 'owner'
  );
--> statement-breakpoint

-- Admins revogam; convidado marca como aceito (apenas para si mesmo, dentro da validade).
CREATE POLICY invites_update ON public.invites
  FOR UPDATE TO authenticated
  USING (
    public.is_org_admin(organization_id)
    OR (
      status = 'pending'
      AND (expires_at IS NULL OR expires_at > now())
      AND (email IS NULL OR email = public.auth_user_email())
    )
  )
  WITH CHECK (
    public.is_org_admin(organization_id)
    OR (
      status = 'accepted'
      AND accepted_by = auth.uid()
    )
  );
--> statement-breakpoint

CREATE POLICY invites_delete ON public.invites
  FOR DELETE TO authenticated
  USING (public.is_org_admin(organization_id));

-- ---------- Triggers (invariantes) ----------

-- Criação de org => criador vira owner (SECURITY DEFINER bypassa a policy de INSERT
-- de members para não depender do fluxo da aplicação).
CREATE OR REPLACE FUNCTION public.handle_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_organization();
--> statement-breakpoint

-- Signup no Supabase => perfil público criado automaticamente.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    lower(NEW.email),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
