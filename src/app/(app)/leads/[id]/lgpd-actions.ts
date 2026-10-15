"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import {
  activities,
  contacts,
  leads,
} from "@/server/db/schema";
import { recordActivity } from "@/server/db/repositories/leads";

/**
 * Direito ao esquecimento (LGPD): elimina o lead com cascata completa —
 * mensagens, conversas, entradas de campanha, rascunhos e timeline —
 * e o contato quando não pertence a outro lead.
 */
export async function deleteLeadAction(formData: FormData): Promise<void> {
  const ctx = await requireOrgContext();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return;

  await withTenantDb(ctx.accessToken, async (db) => {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.organizationId, ctx.organization.id), eq(leads.id, leadId)))
      .limit(1);
    if (!lead) return;

    // timeline do lead (activities não tem FK — remoção explícita)
    await db
      .delete(activities)
      .where(
        and(
          eq(activities.organizationId, ctx.organization.id),
          eq(activities.entityType, "lead"),
          eq(activities.entityId, leadId)
        )
      );

    // rascunhos de IA (FK set null, mas LGPD pede eliminação)
    const { messageDrafts } = await import("@/server/db/schema");
    await db
      .delete(messageDrafts)
      .where(
        and(
          eq(messageDrafts.organizationId, ctx.organization.id),
          eq(messageDrafts.leadId, leadId)
        )
      );

    // lead + dependentes com FK cascade (messages, campaign_leads, conversations…)
    await db
      .delete(leads)
      .where(and(eq(leads.organizationId, ctx.organization.id), eq(leads.id, leadId)));

    // contato órfão (se não pertence a outro lead)
    if (lead.contactId) {
      const [otherLead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, ctx.organization.id),
            eq(leads.contactId, lead.contactId)
          )
        )
        .limit(1);
      if (!otherLead) {
        await db
          .delete(contacts)
          .where(
            and(
              eq(contacts.organizationId, ctx.organization.id),
              eq(contacts.id, lead.contactId)
            )
          );
      }
    }

    // evento de auditoria da própria exclusão (entidade organization)
    await recordActivity(db, {
      organizationId: ctx.organization.id,
      type: "lead_deleted",
      entityType: "organization",
      entityId: ctx.organization.id,
      actorId: ctx.user.id,
      metadata: { leadId, lgpd: "direito ao esquecimento" },
    });
  });

  revalidatePath("/leads");
  redirect("/leads?deleted=1");
}
