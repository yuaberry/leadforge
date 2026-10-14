import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, Lightbulb, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";

import {
  NoteForm,
  StageForm,
  TagChip,
  TagForm,
} from "@/components/leads/lead-forms";
import { AnalyzeButton, DraftCard, GenerateMessageForm } from "@/components/leads/ai-panel";
import { StageBadge } from "@/components/leads/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import {
  getLeadById,
  listLeadActivities,
  listLeadTags,
} from "@/server/db/repositories/leads";
import { getLatestAnalysis, listMessageDrafts } from "@/server/db/repositories/scoring";
import { listProducts } from "@/server/db/repositories/commerce";
import { withTenantDb } from "@/server/db/tenant";
import { activeAIProviderKind } from "@/server/providers/ai";
import { reanalyzeAction } from "./ai-actions";
import { CLASSIFICATION_LABELS, type ScoreClassification } from "@/validators/scoring";

export const metadata: Metadata = {
  title: "Lead",
};

const ACTIVITY_LABELS: Record<string, string> = {
  lead_created: "Lead criado",
  stage_changed: "Estágio alterado",
  tag_added: "Tag adicionada",
  note: "Nota",
  import_completed: "Importação concluída",
};

export default async function LeadProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const lead = await getLeadById(db, ctx.organization.id, id);
    if (!lead) return null;
    const [tags, activities, analysis, drafts, productRows] = await Promise.all([
      listLeadTags(db, ctx.organization.id, id),
      listLeadActivities(db, ctx.organization.id, id),
      getLatestAnalysis(db, ctx.organization.id, id),
      listMessageDrafts(db, ctx.organization.id, id),
      listProducts(db, ctx.organization.id),
    ]);
    return { lead, tags, activities, analysis, drafts, products: productRows };
  });

  if (!data) {
    notFound();
  }

  const { lead, tags, activities, analysis, drafts, products } = data;
  const contact = lead.contact;
  const company = lead.company;
  const activeProducts = products
    .filter(({ product }) => product.status === "active")
    .map(({ product }) => ({ id: product.id, name: product.name }));
  const recommendedProductName =
    products.find(({ product }) => product.id === analysis?.recommendedProductId)?.product.name ??
    null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para leads
        </Link>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {contact?.fullName ?? company?.name ?? "Lead"}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StageBadge stage={lead.lead.stage} />
            {lead.lead.score !== null && (
              <Badge variant="secondary">
                Score {lead.lead.score} ·{" "}
                {CLASSIFICATION_LABELS[
                  (lead.lead.score > 80
                    ? "priority"
                    : lead.lead.score > 60
                      ? "hot"
                      : lead.lead.score > 30
                        ? "warm"
                        : "cold") as ScoreClassification
                ]}
              </Badge>
            )}
            {lead.sourceName && (
              <Badge variant="secondary">Fonte: {lead.sourceName}</Badge>
            )}
            {lead.lead.consentStatus === "granted" ? (
              <Badge variant="success" className="gap-1">
                <ShieldCheck className="size-3" aria-hidden="true" />
                Consentido
              </Badge>
            ) : (
              <Badge variant="warning">Sem consentimento explícito</Badge>
            )}
          </div>
        </div>
        <StageForm leadId={lead.lead.id} stage={lead.lead.stage} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contato */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contact?.email ? (
              <p className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{contact.email}</span>
              </p>
            ) : null}
            {contact?.phone ? (
              <p className="flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" aria-hidden="true" />
                {contact.phone}
              </p>
            ) : null}
            {contact?.jobTitle ? (
              <p className="text-muted-foreground">{contact.jobTitle}</p>
            ) : null}
            {!contact?.email && !contact?.phone && (
              <p className="text-muted-foreground">Sem dados de contato.</p>
            )}
          </CardContent>
        </Card>

        {/* Empresa */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
              Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {company ? (
              <>
                <p className="font-medium">{company.name}</p>
                {company.category && (
                  <p className="text-muted-foreground">{company.category}</p>
                )}
                {company.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Globe className="size-4" aria-hidden="true" />
                    <span className="truncate">{company.website}</span>
                  </a>
                ) : (
                  <p className="rounded-md bg-amber-500/10 px-2 py-1.5 text-xs text-amber-400">
                    Sem website — oportunidade detectada
                  </p>
                )}
                {company.city || company.state ? (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="size-4" aria-hidden="true" />
                    {[company.city, company.state].filter(Boolean).join(" / ")}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">Sem empresa vinculada.</p>
            )}
          </CardContent>
        </Card>

        {/* LGPD / Proveniência */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Proveniência & LGPD</CardTitle>
            <CardDescription className="text-xs">
              Dados de onde veio este lead e sua base legal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Coletado em:{" "}
              <span className="text-foreground">
                {new Date(lead.lead.collectedAt).toLocaleString("pt-BR")}
              </span>
            </p>
            <p>
              Base legal:{" "}
              <span className="text-foreground capitalize">
                {lead.lead.legalBasis
                  ? lead.lead.legalBasis === "legitimate_interest"
                    ? "legítimo interesse"
                    : lead.lead.legalBasis
                  : "não declarada"}
              </span>
            </p>
            {lead.lead.consentAt && (
              <p>
                Consentimento:{" "}
                <span className="text-foreground">
                  {new Date(lead.lead.consentAt).toLocaleString("pt-BR")}
                </span>
              </p>
            )}
            {lead.sourceType && (
              <p>
                Tipo de fonte: <span className="text-foreground capitalize">{lead.sourceType}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inteligência — análise com IA */}
      <Card className="border-violet-500/20 bg-violet-500/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4 text-violet-400" aria-hidden="true" />
            Inteligência com IA
          </CardTitle>
          <CardDescription>
            Análise que separa fatos de hipóteses — nada de achismo. Revisão humana antes de
            qualquer envio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!analysis ? (
            <AnalyzeButton leadId={lead.lead.id} providerKind={activeAIProviderKind()} />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Quem é</p>
                    <p className="text-sm">{analysis.whoIsThis}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Necessidade provável</p>
                    <p className="text-sm">{analysis.probableNeed}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Problema comercial</p>
                    <p className="text-sm">{analysis.commercialProblem}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Oferta sugerida</p>
                    <p className="text-sm">{analysis.suggestedOffer}</p>
                    {recommendedProductName && (
                      <Badge variant="secondary" className="mt-1">
                        Produto: {recommendedProductName}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Argumento principal</p>
                    <p className="text-sm">{analysis.argument}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-background/50 p-3">
                      <p className="text-[11px] font-semibold text-emerald-400">FATOS</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {(analysis.facts as string[]).slice(0, 6).map((fact, index) => (
                          <li key={index}>• {fact}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border bg-background/50 p-3">
                      <p className="text-[11px] font-semibold text-blue-400">INFERÊNCIAS</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {(analysis.inferences as string[]).slice(0, 6).map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border bg-background/50 p-3">
                      <p className="text-[11px] font-semibold text-amber-400">HIPÓTESES</p>
                      <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                        {(analysis.hypotheses as string[]).slice(0, 6).map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 text-center">
                  <p className="text-xs text-muted-foreground">Opportunity Score</p>
                  <p className="text-5xl font-bold text-gradient">
                    {analysis.opportunityScore ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">/100</p>
                  {analysis.priceRange && (
                    <p className="mt-3 text-xs text-muted-foreground">{analysis.priceRange}</p>
                  )}
                  <p className="mt-3 text-[11px] text-muted-foreground/70">
                    via {analysis.provider} · {analysis.model}
                  </p>
                  <form action={reanalyzeAction} className="mt-4 w-full">
                    <input type="hidden" name="leadId" value={lead.lead.id} />
                    <Button type="submit" size="sm" variant="outline" className="w-full">
                      Reanalisar
                    </Button>
                  </form>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <GenerateMessageForm
                  leadId={lead.lead.id}
                  products={activeProducts}
                  defaultChannel={analysis.channel === "email" ? "email" : "whatsapp"}
                  defaultProductId={analysis.recommendedProductId}
                />
              </div>

              {drafts.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    Rascunhos para revisão:
                  </p>
                  {drafts.map(({ draft, productName }) => (
                    <DraftCard
                      key={draft.id}
                      draftId={draft.id}
                      leadId={lead.lead.id}
                      channel={draft.channel}
                      tone={draft.tone}
                      subject={draft.subject}
                      body={draft.body}
                      productName={productName}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma tag ainda.</p>
            )}
            {tags.map((tag) => (
              <TagChip key={tag.id} leadId={lead.lead.id} tagId={tag.id} name={tag.name} />
            ))}
          </div>
          <TagForm leadId={lead.lead.id} />
        </CardContent>
      </Card>

      {/* Notas + Histórico */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nota rápida</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm leadId={lead.lead.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Histórico</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {activities.length === 0 && (
                <li className="text-sm text-muted-foreground">Sem eventos registrados.</li>
              )}
              {activities.map((activity) => (
                <li key={activity.id} className="border-l-2 border-border pl-3">
                  <p className="text-sm font-medium">
                    {ACTIVITY_LABELS[activity.type] ?? activity.type}
                    {activity.type === "stage_changed" &&
                      (activity.metadata as { stage?: string })?.stage && (
                        <span className="ml-1 text-muted-foreground">
                          → {(activity.metadata as { stage: string }).stage}
                        </span>
                      )}
                  </p>
                  {activity.type === "note" &&
                    (activity.metadata as { text?: string })?.text && (
                      <p className="text-sm text-muted-foreground">
                        {(activity.metadata as { text: string }).text}
                      </p>
                    )}
                  <p className="text-xs text-muted-foreground/70">
                    {new Date(activity.createdAt).toLocaleString("pt-BR")}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
