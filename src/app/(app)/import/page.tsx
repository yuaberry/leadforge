import type { Metadata } from "next";

import { UploadForm } from "@/components/import/upload-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Importar CSV",
};

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar lista de contatos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV com até 1000 linhas · normalização e deduplicação automáticas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Declare a proveniência (obrigatório)</CardTitle>
          <CardDescription>
            Requisito LGPD: importar listas de terceiros sem base legal é proibido na plataforma.
            A declaração fica registrada em cada lead importado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colunas reconhecidas</CardTitle>
          <CardDescription>
            O mapeamento é sugerido automaticamente por estes nomes de cabeçalho:
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              nome, empresa, email, telefone, website, cidade, estado, país, categoria, cargo,
              observações
            </code>
          </p>
          <p className="mt-2">
            Linhas válidas precisam de e-mail, telefone, ou empresa+nome.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
