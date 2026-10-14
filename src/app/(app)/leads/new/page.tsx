import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateLeadForm } from "@/components/leads/create-lead-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Novo lead",
};

export default function NewLeadPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Voltar para leads
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Novo lead</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cadastro manual</CardTitle>
          <CardDescription>
            A normalização e a deduplicação rodam automaticamente — se o lead já existir, ele
            será detectado por e-mail, telefone, domínio ou nome+cidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateLeadForm />
        </CardContent>
      </Card>
    </div>
  );
}
