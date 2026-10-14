/**
 * Testes de Row Level Security — GATE da Phase 1.
 *
 * Pré-requisito: DATABASE_URL configurado e migrations aplicadas:
 *   bun run db:migrate
 *
 * Sem DATABASE_URL, a suíte é pulada (o gate de fase segue verde com os
 * testes unitários; ao configurar o Supabase, esta suíte ativa sozinha).
 *
 * Invariáveis testadas:
 *   1. Tenant A nunca vê dados do tenant B.
 *   2. Escalada de privilégio é bloqueada (invite de owner, insert cross-tenant).
 *   3. Trigger de owner funciona no fluxo real (claims autenticadas).
 *   4. O mecanismo withTenantDb (SET LOCAL ROLE + claims) usado pelo app.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

const suite = describe.skipIf(!DATABASE_URL);

suite("RLS — isolamento entre tenants", () => {
  type SqlClient = postgres.Sql<Record<string, unknown>>;
  let service: SqlClient;

  const idA = randomUUID();
  const idB = randomUUID();
  const idC = randomUUID();
  let orgA: string;
  let orgB: string;
  const createdOrgIds: string[] = [];

  async function asUser<T>(
    userId: string,
    claims: { email?: string },
    fn: (tx: postgres.TransactionSql<Record<string, unknown>>) => Promise<T>
  ): Promise<T> {
    const result = await service.begin(async (tx) => {
      const jwt = JSON.stringify({
        sub: userId,
        role: "authenticated",
        ...(claims.email ? { email: claims.email } : {}),
      });
      await tx`SELECT set_config('request.jwt.claims', ${jwt}, true)`;
      await tx`SET LOCAL ROLE authenticated`;
      return (await fn(tx)) as unknown as T;
    });
    return result as T;
  }

  beforeAll(async () => {
    service = postgres(DATABASE_URL as string, { max: 5 });

    // Seed direto como owner (bypassa RLS; o trigger de org não cria
    // membership porque auth.uid() é null nesta conexão).
    await service`
      INSERT INTO public.users (id, full_name, email)
      VALUES
        (${idA}, 'User A', 'a@test.local'),
        (${idB}, 'User B', 'b@test.local'),
        (${idC}, 'User C', 'c@test.local')
    `;

    const [rowA] = await service`
      INSERT INTO public.organizations (name, slug)
      VALUES ('Org A', ${"orga-" + idA.slice(0, 8)})
      RETURNING id
    `;
    const [rowB] = await service`
      INSERT INTO public.organizations (name, slug)
      VALUES ('Org B', ${"orgb-" + idB.slice(0, 8)})
      RETURNING id
    `;
    orgA = rowA.id;
    orgB = rowB.id;
    createdOrgIds.push(orgA, orgB);

    await service`
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES
        (${orgA}, ${idA}, 'owner'),
        (${orgB}, ${idB}, 'owner')
    `;
  });

  afterAll(async () => {
    if (service) {
      for (const orgId of createdOrgIds) {
        await service`DELETE FROM public.organizations WHERE id = ${orgId}`;
      }
      await service`DELETE FROM public.users WHERE id IN (${idA}, ${idB}, ${idC})`;
      await service.end({ timeout: 5 });
    }
  });

  it("tenant A vê apenas a própria organização", async () => {
    const rows = await asUser(idA, {}, (tx) =>
      tx`SELECT id FROM public.organizations`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(orgA);
  });

  it("tenant A não vê memberships do tenant B", async () => {
    const rows = await asUser(idA, {}, (tx) =>
      tx`SELECT * FROM public.organization_members WHERE organization_id = ${orgB}`
    );
    expect(rows).toHaveLength(0);
  });

  it("tenant A não atualiza organização do tenant B", async () => {
    const result = await asUser(idA, {}, (tx) =>
      tx`UPDATE public.organizations SET name = 'Hackeada' WHERE id = ${orgB}`
    );
    expect(result.count).toBe(0);

    const [org] = await service`SELECT name FROM public.organizations WHERE id = ${orgB}`;
    expect(org.name).toBe("Org B");
  });

  it("tenant A não insere membro em organização do tenant B", async () => {
    await expect(
      asUser(idA, {}, (tx) =>
        tx`INSERT INTO public.organization_members (organization_id, user_id, role)
           VALUES (${orgB}, ${idA}, 'member')`
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("usuário sem organização não vê nenhuma organização", async () => {
    const rows = await asUser(idC, {}, (tx) =>
      tx`SELECT id FROM public.organizations`
    );
    expect(rows).toHaveLength(0);
  });

  it("perfil de não-membro é invisível (users select policy)", async () => {
    const rows = await asUser(idA, {}, (tx) =>
      tx`SELECT id FROM public.users WHERE id = ${idB}`
    );
    expect(rows).toHaveLength(0);
  });

  it("trigger promove criador a owner na criação da org (fluxo real)", async () => {
    const [orgC] = await asUser(idC, {}, (tx) =>
      tx`INSERT INTO public.organizations (name, slug)
         VALUES ('Org C', ${"orgc-" + idC.slice(0, 8)})
         RETURNING id`
    );
    createdOrgIds.push(orgC.id);

    const members = await asUser(idC, {}, (tx) =>
      tx`SELECT role FROM public.organization_members WHERE organization_id = ${orgC.id}`
    );
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe("owner");
  });

  it("convite com papel owner é bloqueado pela policy (anti-escalada)", async () => {
    await expect(
      asUser(idA, {}, (tx) =>
        tx`INSERT INTO public.invites (organization_id, email, role, token, created_by, expires_at)
           VALUES (${orgA}, NULL, 'owner', ${"tok-" + randomUUID()}, ${idA}, now() + interval '7 days')`
      )
    ).rejects.toThrow(/row-level security/i);
  });

  it("fluxo de convite: aceite válido funciona, e-mail errado é bloqueado", async () => {
    const token = "tok-" + randomUUID();

    // A (owner da Org A) cria convite para c@test.local
    await asUser(idA, {}, (tx) =>
      tx`INSERT INTO public.invites (organization_id, email, role, token, created_by, expires_at)
         VALUES (${orgA}, 'c@test.local', 'member', ${token}, ${idA}, now() + interval '7 days')`
    );

    // B (e-mail diferente) tenta aceitar — bloqueado
    await expect(
      asUser(idB, { email: "b@test.local" }, (tx) =>
        tx`INSERT INTO public.organization_members (organization_id, user_id, role)
           VALUES (${orgA}, ${idB}, 'member')`
      )
    ).rejects.toThrow(/row-level security/i);

    // C (e-mail certo) aceita com sucesso
    await asUser(idC, { email: "c@test.local" }, async (tx) => {
      await tx`INSERT INTO public.organization_members (organization_id, user_id, role)
                VALUES (${orgA}, ${idC}, 'member')`;
      const res = await tx`UPDATE public.invites
                SET status = 'accepted', accepted_by = ${idC}, accepted_at = now()
                WHERE token = ${token}`;
      expect(res.count).toBe(1);
    });

    // C agora vê a Org A
    const rows = await asUser(idC, { email: "c@test.local" }, (tx) =>
      tx`SELECT id FROM public.organizations`
    );
    expect(rows.map((r) => String(r.id))).toContain(orgA);
  });

  it("withTenantDb (mecanismo de produção) roda sob RLS com claims", async () => {
    const { withTenantDb } = await import("@/server/db/tenant");
    const { organizations } = await import("@/server/db/schema");

    const rows = await withTenantDb(
      JSON.stringify({ sub: idA, role: "authenticated" }),
      async (db) => {
        const result = await db.select().from(organizations);
        return result;
      }
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(orgA);
  });

  it("Phase 2: leads e companies de outra org são invisíveis e imutáveis", async () => {
    const [companyA] = await service`
      INSERT INTO public.companies (organization_id, name) VALUES (${orgA}, 'Empresa A') RETURNING id
    `;
    const [leadA] = await service`
      INSERT INTO public.leads (organization_id, company_id, stage)
      VALUES (${orgA}, ${companyA.id}, 'new') RETURNING id
    `;
    const [companyB] = await service`
      INSERT INTO public.companies (organization_id, name) VALUES (${orgB}, 'Empresa B') RETURNING id
    `;
    const [leadB] = await service`
      INSERT INTO public.leads (organization_id, company_id, stage)
      VALUES (${orgB}, ${companyB.id}, 'new') RETURNING id
    `;

    // A vê apenas o lead da própria org
    const rowsA = await asUser(idA, {}, (tx) => tx`SELECT id FROM public.leads`);
    const idsA = rowsA.map((r) => String(r.id));
    expect(idsA).toContain(leadA.id);
    expect(idsA).not.toContain(leadB.id);

    // A vê apenas a company da própria org
    const companiesA = await asUser(idA, {}, (tx) => tx`SELECT id FROM public.companies`);
    const companyIdsA = companiesA.map((r) => String(r.id));
    expect(companyIdsA).toContain(companyA.id);
    expect(companyIdsA).not.toContain(companyB.id);

    // A não atualiza o lead do tenant B
    const updateRes = await asUser(idA, {}, (tx) =>
      tx`UPDATE public.leads SET stage = 'won' WHERE id = ${leadB.id}`
    );
    expect(updateRes.count).toBe(0);

    // A não insere lead na org B (policy de insert)
    await expect(
      asUser(idA, {}, (tx) =>
        tx`INSERT INTO public.leads (organization_id, stage) VALUES (${orgB}, 'new')`
      )
    ).rejects.toThrow(/row-level security/i);

    // Sem membership alguma, C não vê nenhum lead (default deny)
    const rowsC = await asUser(idC, {}, (tx) => tx`SELECT id FROM public.leads`);
    expect(rowsC).toHaveLength(0);
  });

  it("Phase 2: dedup de leads é garantido por índice único (company × contact)", async () => {
    const [contact] = await service`
      INSERT INTO public.contacts (organization_id, full_name, email, email_normalized)
      VALUES (${orgA}, 'Duplicado Silva', 'dup@test.local', 'dup@test.local') RETURNING id
    `;

    // primeira inserção ok
    await asUser(idA, {}, (tx) =>
      tx`INSERT INTO public.leads (organization_id, company_id, contact_id)
         VALUES (${orgA}, NULL, ${contact.id})`
    );

    // segunda inserção com o mesmo par conflita (índice único parcial)
    await expect(
      asUser(idA, {}, (tx) =>
        tx`INSERT INTO public.leads (organization_id, company_id, contact_id)
           VALUES (${orgA}, NULL, ${contact.id})`
      )
    ).rejects.toThrow(/duplicate key|unique/i);

    await service`DELETE FROM public.contacts WHERE id = ${contact.id}`;
  });
});
