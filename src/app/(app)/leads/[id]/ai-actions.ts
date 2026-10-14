"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and as drizzleAnd, eq as drizzleEq } from "drizzle-orm";

import { requireOrgContext } from "@/server/auth/session";
import { withTenantDb } from "@/server/db/tenant";
import { getLeadById, recordActivity } from "@/server/db/repositories/leads";
import {
  getLatestAnalysis,
  insertLeadAnalysis,
  insertMessageDraft,
  saveLeadScore,
  updateMessageDraft,
  discardMessageDraft,
} from "@/server/db/repositories/scoring";
import { listProducts } from "@/server/db/repositories/commerce";
import { linkTokens, products as productsTable } from "@/server/db/schema";
import { getAIProvider } from "@/server/providers/ai";
import { AIProviderError, type LeadAnalysisInput } from "@/server/providers/ai/types";
import { computeLeadScore, signalsFromLeadData } from "@/server/services/scoring";
import { parseOrgSettings } from "@/validators/org";
import {
  generateMessageFormSchema,
  saveDraftEditSchema,
  discardDraftSchema,
} from "@/validators/scoring";

type AIState = { error?: string; success?: string } | null;

/** Wrapper para plain <form action=...> (assimatura FormData). */
export async function reanalyzeAction(formData: FormData): Promise<void> {
  await analyzeLeadAction(null, formData);
}

type TenantTx = Parameters<Parameters<typeof withTenantDb>[1]>[0];

/** Monta o payload da análise a partir dos dados REAIS do lead + catálogo. */
async function buildAnalysisInput(
  db: TenantTx,
  organizationId: string,
  leadId: string,
  orgCategories: string[]
): Promise<LeadAnalysisInput | null> {
  const leadRow = await getLeadById(db, organizationId, leadId);
  if (!leadRow) return null;

  const products = (await listProducts(db, organizationId))
    .filter(({ product }) => product.status === "active")
    .map(({ product }) => ({
      id: product.id,
      name: product.name,
      type: product.type,
      category: product.category,
      targetAudience: product.targetAudience,
      sellingArguments: product.sellingArguments as string[],
      price: product.price,
    }));

  return {
    lead: {
      contactName: leadRow.contact?.fullName ?? null,
      contactEmail: leadRow.contact?.email ?? null,
      contactPhone: leadRow.contact?.phone ?? null,
      companyName: leadRow.company?.name ?? null,
      companyWebsite: leadRow.company?.website ?? null,
      companyCategory: leadRow.company?.category ?? null,
      companyCity: leadRow.company?.city ?? null,
      companyState: leadRow.company?.state ?? null,
      notes: leadRow.lead.notes ?? null,
      source: leadRow.sourceName ?? leadRow.sourceType ?? "desconhecida",
      consentStatus: leadRow.lead.consentStatus,
    },
    products,
    orgCategories,
  };
}

export async function analyzeLeadAction(_prev: AIState, formData: FormData): Promise<AIState> {
  const ctx = await requireOrgContext();
  const leadId = String(formData.get("leadId") ?? "");
  if (!leadId) return { error: "Lead inválido." };

  const provider = getAIProvider();
  const settings = parseOrgSettings(ctx.organization.settings);

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const input = await buildAnalysisInput(
        db,
        ctx.organization.id,
        leadId,
        settings.categories
      );
      if (!input) throw new Error("Lead não encontrado.");

      const result = await provider.analyzeLead(input);

      await insertLeadAnalysis(db, {
        organizationId: ctx.organization.id,
        leadId,
        provider: provider.kind,
        model: provider.model,
        status: "completed",
        whoIsThis: result.whoIsThis,
        probableNeed: result.probableNeed,
        commercialProblem: result.commercialProblem,
        recommendedProductId: result.recommendedProductId,
        opportunityScore: result.opportunityScore,
        suggestedOffer: result.suggestedOffer,
        priceRange: result.priceRange,
        argument: result.argument,
        channel: result.channel,
        facts: result.facts,
        inferences: result.inferences,
        hypotheses: result.hypotheses,
      });

      // Rescore: a análise alimenta o sinal ai_need
      const leadRow = await getLeadById(db, ctx.organization.id, leadId);
      if (leadRow) {
        const signals = signalsFromLeadData({
          company: leadRow.company
            ? {
                website: leadRow.company.website,
                instagram: leadRow.company.instagram,
                facebook: leadRow.company.facebook,
                linkedin: leadRow.company.linkedin,
                city: leadRow.company.city,
                state: leadRow.company.state,
                addressLine: leadRow.company.addressLine,
                phone: leadRow.company.phone,
                category: leadRow.company.category,
                externalId: leadRow.company.externalId,
              }
            : null,
          contact: leadRow.contact
            ? { email: leadRow.contact.email, phone: leadRow.contact.phone }
            : null,
          orgCategories: settings.categories,
          latestAnalysisOpportunityScore: result.opportunityScore,
        });
        const score = computeLeadScore(signals, settings.scoreWeights);
        await saveLeadScore(db, {
          organizationId: ctx.organization.id,
          leadId,
          total: score.total,
          classification: score.classification,
          breakdown: score.breakdown,
          weightsSnapshot: settings.scoreWeights,
        });
      }

      await recordActivity(db, {
        organizationId: ctx.organization.id,
        type: "ai_analysis",
        entityType: "lead",
        entityId: leadId,
        actorId: ctx.user.id,
        metadata: {
          provider: provider.kind,
          opportunityScore: result.opportunityScore,
          recommendedProductId: result.recommendedProductId,
        },
      });
    });
  } catch (erro) {
    const message =
      erro instanceof AIProviderError || erro instanceof Error
        ? erro.message
        : "Erro ao analisar o lead.";
    try {
      await withTenantDb(ctx.accessToken, (db) =>
        insertLeadAnalysis(db, {
          organizationId: ctx.organization.id,
          leadId,
          provider: provider.kind,
          model: provider.model,
          status: "failed",
          error: message.slice(0, 500),
        })
      );
    } catch {
      // falha ao registrar a falha — não mascarar o erro original
    }
    return { error: message };
  }

  revalidatePath(`/leads/${leadId}`);
  return { success: "Análise concluída." };
}

/** Link rastreado por (lead, produto) — criado uma vez, reusado nas mensagens. */
async function findOrCreateLeadLinkToken(
  db: TenantTx,
  organizationId: string,
  leadId: string,
  productId: string | null
): Promise<string | null> {
  if (!productId) return null;

  const [existing] = await db
    .select()
    .from(linkTokens)
    .where(
      drizzleAnd(
        drizzleEq(linkTokens.organizationId, organizationId),
        drizzleEq(linkTokens.leadId, leadId),
        drizzleEq(linkTokens.productId, productId)
      )
    )
    .limit(1);

  if (existing) return existing.token;

  const [created] = await db
    .insert(linkTokens)
    .values({
      organizationId,
      productId,
      leadId,
      label: "Mensagem IA",
      token: randomBytes(12).toString("base64url"),
    })
    .returning();
  return created.token;
}

async function appOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMessageAction(_prev: AIState, formData: FormData): Promise<AIState> {
  const ctx = await requireOrgContext();

  const parsed = generateMessageFormSchema.safeParse({
    leadId: String(formData.get("leadId") ?? ""),
    analysisId: String(formData.get("analysisId") ?? ""),
    productId: String(formData.get("productId") ?? ""),
    tone: String(formData.get("tone") ?? ""),
    channel: String(formData.get("channel") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const provider = getAIProvider();

  try {
    await withTenantDb(ctx.accessToken, async (db) => {
      const leadRow = await getLeadById(db, ctx.organization.id, parsed.data.leadId);
      if (!leadRow) throw new Error("Lead não encontrado.");

      const analysis = await getLatestAnalysis(db, ctx.organization.id, parsed.data.leadId);

      let product: { id: string; name: string; category: string | null } | null = null;
      const targetProductId =
        parsed.data.productId || analysis?.recommendedProductId || null;
      if (targetProductId) {
        const [productRow] = await db
          .select({
            id: productsTable.id,
            name: productsTable.name,
            category: productsTable.category,
          })
          .from(productsTable)
          .where(
            drizzleAnd(
              drizzleEq(productsTable.organizationId, ctx.organization.id),
              drizzleEq(productsTable.id, targetProductId)
            )
          )
          .limit(1);
        product = productRow ?? null;
      }

      const token = await findOrCreateLeadLinkToken(
        db,
        ctx.organization.id,
        parsed.data.leadId,
        product?.id ?? null
      );
      const trackedLink = token ? `${await appOrigin()}/go/${token}` : null;

      const generated = await provider.generateMessage({
        channel: parsed.data.channel,
        tone: parsed.data.tone,
        goal: "apresentar a oferta e iniciar a conversa",
        lead: {
          contactName: leadRow.contact?.fullName ?? null,
          contactEmail: leadRow.contact?.email ?? null,
          contactPhone: leadRow.contact?.phone ?? null,
          companyName: leadRow.company?.name ?? null,
          companyWebsite: leadRow.company?.website ?? null,
          companyCategory: leadRow.company?.category ?? null,
          companyCity: leadRow.company?.city ?? null,
          companyState: leadRow.company?.state ?? null,
          notes: leadRow.lead.notes ?? null,
          source: leadRow.sourceName ?? "desconhecida",
          consentStatus: leadRow.lead.consentStatus,
        },
        product,
        analysis: analysis
          ? {
              argument: analysis.argument ?? "",
              probableNeed: analysis.probableNeed ?? "",
              suggestedOffer: analysis.suggestedOffer ?? "",
            }
          : null,
        trackedLink,
      });

      await insertMessageDraft(db, {
        organizationId: ctx.organization.id,
        leadId: parsed.data.leadId,
        analysisId: analysis?.id ?? null,
        productId: product?.id ?? null,
        channel: parsed.data.channel,
        tone: parsed.data.tone,
        subject: generated.subject,
        body: generated.body,
      });
    });
  } catch (erro) {
    return { error: erro instanceof Error ? erro.message : "Erro ao gerar a mensagem." };
  }

  revalidatePath(`/leads/${parsed.data.leadId}`);
  return { success: "Mensagem gerada — revise antes de usar." };
}

export async function editDraftAction(_prev: AIState, formData: FormData): Promise<AIState> {
  const ctx = await requireOrgContext();

  const parsed = saveDraftEditSchema.safeParse({
    draftId: String(formData.get("draftId") ?? ""),
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const leadId = String(formData.get("leadId") ?? "");

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      updateMessageDraft(db, ctx.organization.id, parsed.data.draftId, {
        subject: parsed.data.subject || null,
        body: parsed.data.body,
      })
    );
  } catch {
    return { error: "Erro ao salvar o rascunho." };
  }

  if (leadId) revalidatePath(`/leads/${leadId}`);
  return { success: "Rascunho atualizado." };
}

export async function discardDraftAction(_prev: AIState, formData: FormData): Promise<AIState> {
  const ctx = await requireOrgContext();

  const parsed = discardDraftSchema.safeParse({
    draftId: String(formData.get("draftId") ?? ""),
  });
  if (!parsed.success) return { error: "Dados inválidos." };

  const leadId = String(formData.get("leadId") ?? "");

  try {
    await withTenantDb(ctx.accessToken, (db) =>
      discardMessageDraft(db, ctx.organization.id, parsed.data.draftId)
    );
  } catch {
    return { error: "Erro ao descartar o rascunho." };
  }

  if (leadId) revalidatePath(`/leads/${leadId}`);
  return { success: "Rascunho descartado." };
}
