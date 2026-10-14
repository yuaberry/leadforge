import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { CaptureLink, EditPageForm, PageStatusForm } from "@/components/capture/page-forms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { capturePageStats, getCapturePage } from "@/server/db/repositories/capture";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Editar captura",
};

export default async function EditCapturePagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireOrgContext();

  const data = await withTenantDb(ctx.accessToken, async (db) => {
    const page = await getCapturePage(db, ctx.organization.id, id);
    if (!page) return null;
    const stats = await capturePageStats(db, ctx.organization.id, page.id);
    return { page, stats };
  });

  if (!data) notFound();
  const { page, stats } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/capture"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para capturas
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{page.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={page.status === "published" ? "success" : "secondary"} className="capitalize">
            {page.status === "published" ? "Publicada" : page.status === "archived" ? "Arquivada" : "Rascunho"}
          </Badge>
          {page.status === "published" && <CaptureLink slug={page.slug} />}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Só páginas publicadas aceitam inscrições no link público.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PageStatusForm pageId={page.id} status={page.status} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdo</CardTitle>
          <CardDescription>Edite os textos exibidos na página pública.</CardDescription>
        </CardHeader>
        <CardContent>
          <EditPageForm
            page={{
              id: page.id,
              title: page.title,
              slug: page.slug,
              headline: page.headline,
              subheadline: page.subheadline,
              leadMagnetUrl: page.leadMagnetUrl,
              thankYouMessage: page.thankYouMessage,
              consentText: page.consentText,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inscrições ({stats.total})</CardTitle>
          <CardDescription>
            Cada envio do formulário, com consentimento e UTM registrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma inscrição ainda.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {stats.submissions.map((submission) => {
                const utm = submission.utm as Record<string, string | undefined>;
                return (
                  <li key={submission.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-muted-foreground">
                      {new Date(submission.createdAt).toLocaleString("pt-BR")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {utm.utm_source ? `utm: ${utm.utm_source}` : "acesso direto"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
