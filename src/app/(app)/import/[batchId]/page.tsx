import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ImportRunner } from "@/components/import/import-runner";
import { MappingForm } from "@/components/import/mapping-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrgContext } from "@/server/auth/session";
import { getImportBatch, type ImportProgress } from "@/server/db/repositories/imports";
import { withTenantDb } from "@/server/db/tenant";

export const metadata: Metadata = {
  title: "Importação",
};

export default async function ImportBatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const ctx = await requireOrgContext();

  const batch = await withTenantDb(ctx.accessToken, (db) =>
    getImportBatch(db, ctx.organization.id, batchId)
  );

  if (!batch) notFound();

  const headers = batch.headers as string[];
  const rows = batch.rows as string[][];
  const mapping = batch.mapping as Record<string, number | undefined>;
  const progress = batch.status === "completed" ? (batch.results as ImportProgress | null) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/import"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Nova importação
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{batch.filename}</h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="secondary">{batch.totalRows} linhas</Badge>
          <Badge variant="secondary">
            {batch.legalBasis === "legitimate_interest"
              ? "legítimo interesse"
              : batch.legalBasis}
          </Badge>
          <Badge
            variant={
              batch.status === "completed" ? "success" : batch.status === "failed" ? "destructive" : "secondary"
            }
          >
            {batch.status === "preview"
              ? "Mapeamento pendente"
              : batch.status === "mapped"
                ? "Pronto para importar"
                : batch.status === "completed"
                  ? "Concluída"
                  : batch.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proveniência declarada</CardTitle>
          <CardDescription>
            Registrada em cada lead importado deste lote (LGPD).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {batch.provenanceSource}
        </CardContent>
      </Card>

      {batch.status === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle>2. Confirme o mapeamento das colunas</CardTitle>
            <CardDescription>
              Sugestão automática detectada — ajuste se necessário.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MappingForm
              batchId={batch.id}
              headers={headers}
              headersCount={headers.length}
              initialMapping={mapping}
              sampleRows={rows.slice(0, 3)}
            />
          </CardContent>
        </Card>
      )}

      {batch.status === "mapped" && (
        <Card>
          <CardHeader>
            <CardTitle>3. Executar importação</CardTitle>
            <CardDescription>
              Normalização + deduplicação rodam por bloco. Você pode recarregar a página sem
              perder o progresso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportRunner batchId={batch.id} totalRows={batch.totalRows} />
          </CardContent>
        </Card>
      )}

      {batch.status === "completed" && progress && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Relatório final</CardTitle>
              <CardDescription>
                Concluída em{" "}
                {batch.completedAt ? new Date(batch.completedAt).toLocaleString("pt-BR") : "—"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-emerald-400">{progress.createdLeads}</p>
                  <p className="text-xs text-muted-foreground">leads criados</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-blue-400">{progress.duplicates}</p>
                  <p className="text-xs text-muted-foreground">duplicados</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-violet-400">{progress.createdCompanies}</p>
                  <p className="text-xs text-muted-foreground">empresas</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-2xl font-bold text-red-400">{progress.errors.length}</p>
                  <p className="text-xs text-muted-foreground">erros</p>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Linhas com erro (mostrando até 50):
                  </p>
                  <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border p-3 text-xs">
                    {progress.errors.slice(0, 50).map((erro, index) => (
                      <li key={index} className="text-muted-foreground">
                        <span className="font-semibold text-foreground">Linha {erro.row}:</span>{" "}
                        {erro.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Link
              href="/leads"
              className="flex-1 rounded-md border border-primary bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver leads importados
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
