import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Globe, Mail, MapPin, Phone, ShieldCheck, Sparkles } from "lucide-react";

import {
  NoteForm,
  StageForm,
  TagChip,
  TagForm,
} from "@/components/leads/lead-forms";
import { StageBadge } from "@/components/leads/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import {
  getLeadById,
  listLeadActivities,
  listLeadTags,
} from "@/server/db/repositories/leads";
import { withTenantDb } from "@/server/db/tenant";

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
    const [tags, activities] = await Promise.all([
      listLeadTags(db, ctx.organization.id, id),
      listLeadActivities(db, ctx.organization.id, id),
    ]);
    return { lead, tags, activities };
  });

  if (!data) {
    notFound();
  }

  const { lead, tags, activities } = data;
  const contact = lead.contact;
  const company = lead.company;

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

      {/* Inteligência (placeholder honesto da Fase 4) */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-violet-400" aria-hidden="true" />
            Inteligência com IA
          </CardTitle>
          <CardDescription>
            Análise do lead, score, recomendação de produto e geração de mensagem chegam na Fase 4.
          </CardDescription>
        </CardHeader>
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
