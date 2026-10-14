"use client";

import { useActionState } from "react";

import { createImportBatchAction } from "@/app/(app)/import/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IMPORT_LEGAL_BASES } from "@/validators/import";

type State = { error?: string } | null;

export function UploadForm() {
  const [state, formAction, pending] = useActionState<State, FormData>(createImportBatchAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="provenanceSource">De onde vêm estes contatos?</Label>
        <Input
          id="provenanceSource"
          name="provenanceSource"
          placeholder="Ex.: minha lista própria de clientes da loja"
          required
          minLength={5}
          maxLength={300}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="legalBasis">Base legal (LGPD)</Label>
        <select
          id="legalBasis"
          name="legalBasis"
          required
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Selecione...
          </option>
          {IMPORT_LEGAL_BASES.map((basis) => (
            <option key={basis.value} value={basis.value}>
              {basis.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirmedRights"
          required
          className="mt-1 size-4 rounded border-input"
        />
        <span className="text-muted-foreground">
          Declaro que tenho direito de usar estes dados para contato comercial e que a lista
          não foi obtida de fontes proibidas.
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="file">Arquivo CSV (máx. 2 MB / 1000 linhas)</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Analisando arquivo..." : "Enviar e mapear colunas"}
      </Button>
    </form>
  );
}
