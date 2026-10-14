"use client";

import { useActionState, useState } from "react";

import { saveMappingAction } from "@/app/(app)/import/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IMPORT_FIELDS } from "@/server/services/csv";

type State = { error?: string } | null;

export function MappingForm({
  batchId,
  headers,
  headersCount,
  initialMapping,
  sampleRows,
}: {
  batchId: string;
  headers: string[];
  headersCount: number;
  initialMapping: Record<string, number | undefined>;
  sampleRows: string[][];
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(saveMappingAction, null);
  const [mapping, setMapping] = useState<Record<string, number | undefined>>(initialMapping);

  const hiddenValue = JSON.stringify(
    Object.fromEntries(Object.entries(mapping).filter(([, v]) => typeof v === "number"))
  );

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <input type="hidden" name="batchId" value={batchId} />
      <input type="hidden" name="mapping" value={hiddenValue} />
      <input type="hidden" name="headersCount" value={headersCount} />

      <div className="grid gap-3 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label htmlFor={`map-${field.key}`} className="text-xs font-medium">
              {field.label}
            </label>
            <select
              id={`map-${field.key}`}
              value={mapping[field.key] ?? ""}
              onChange={(event) =>
                setMapping((prev) => ({
                  ...prev,
                  [field.key]: event.target.value === "" ? undefined : Number(event.target.value),
                }))
              }
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">— não usar —</option>
              {headers.map((header, index) => (
                <option key={`${header}-${index}`} value={index}>
                  {header || `coluna ${index + 1}`}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Prévia das primeiras linhas:
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-secondary/50">
              <tr>
                {headers.map((header, index) => (
                  <th key={`${header}-${index}`} className="px-2 py-1.5 text-left font-medium">
                    {header || `col ${index + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border">
                  {headers.map((_, colIndex) => (
                    <td key={colIndex} className="max-w-40 truncate px-2 py-1.5 text-muted-foreground">
                      {row[colIndex] ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando..." : "Confirmar mapeamento"}
      </Button>
    </form>
  );
}
