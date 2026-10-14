import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { CaptureLink, CreatePageForm } from "@/components/capture/page-forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { listCapturePages } from "@/server/db/repositories/capture";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Captura",
};

const STATUS_BADGE: Record<string, "secondary" | "success" | "destructive"> = {
  draft: "secondary",
  published: "success",
  archived: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  archived: "Arquivada",
};

export default async function CapturePage() {
  const ctx = await requireOrgContext();

  const pages = await withTenantDb(ctx.accessToken, (db) =>
    listCapturePages(db, ctx.organization.id)
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Páginas de captura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua máquina de lista própria: páginas públicas com consentimento LGPD registrado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" aria-hidden="true" />
            Nova página
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreatePageForm />
        </CardContent>
      </Card>

      {pages.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          Nenhuma página ainda — crie a primeira acima.
        </p>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <Card key={page.id}>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/capture/${page.id}`}
                      className="truncate text-sm font-medium hover:text-primary"
                    >
                      {page.title}
                    </Link>
                    <Badge variant={STATUS_BADGE[page.status] ?? "secondary"}>
                      {STATUS_LABEL[page.status] ?? page.status}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {page.subheadline || page.headline}
                  </p>
                  {page.status === "published" && <CaptureLink slug={page.slug} />}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {page.submissionsCount} inscriç{page.submissionsCount === 1 ? "ão" : "ões"}
                  </p>
                </div>

                <Button size="sm" variant="secondary" asChild className="shrink-0">
                  <Link href={`/capture/${page.id}`}>Editar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
