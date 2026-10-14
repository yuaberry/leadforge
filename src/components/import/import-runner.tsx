"use client";

import { useState } from "react";

import { runImportChunkAction } from "@/app/(app)/import/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ImportProgress } from "@/server/db/repositories/imports";

/**
 * Conduz a importação chamando runImportChunkAction até concluir.
 * O progresso persiste no lote (resumível) — recarregar a página não
 * perde nada. Na Fase 6, a fila assume este trabalho no servidor.
 */
export function ImportRunner({
  batchId,
  totalRows,
}: {
  batchId: string;
  totalRows: number;
}) {
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function run() {
    setRunning(true);
    setError(null);

    try {
      let finished = false;
      while (!finished) {
        const result = await runImportChunkAction(batchId);
        if (!result.ok) {
          setError(result.error);
          break;
        }
        finished = result.done;
        setProgress(result.progress);
      }
      if (!error) setDone(true);
    } catch (erro) {
      setError(erro instanceof Error ? erro.message : "Erro inesperado durante a importação.");
    } finally {
      setRunning(false);
    }
  }

  const processed = progress?.processed ?? 0;
  const percent = totalRows > 0 ? Math.round((processed / totalRows) * 100) : 0;

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!done && !running && (
        <Button onClick={run} className="w-full">
          Iniciar importação de {totalRows} linha{totalRows === 1 ? "" : "s"}
        </Button>
      )}

      {(running || progress) && (
        <div className="space-y-3">
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400 transition-all"
              style={{ width: `${percent}%` }}
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {running ? "Processando..." : "Processado"} {processed}/{totalRows} ({percent}%)
          </p>

          {progress && (
            <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
              <div className="rounded-lg border p-2">
                <p className="font-semibold text-emerald-400">{progress.createdLeads}</p>
                <p className="text-xs text-muted-foreground">leads criados</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="font-semibold text-blue-400">{progress.duplicates}</p>
                <p className="text-xs text-muted-foreground">duplicados ignorados</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="font-semibold text-violet-400">{progress.createdCompanies}</p>
                <p className="text-xs text-muted-foreground">empresas novas</p>
              </div>
              <div className="rounded-lg border p-2">
                <p className="font-semibold text-red-400">{progress.errors.length}</p>
                <p className="text-xs text-muted-foreground">linhas com erro</p>
              </div>
            </div>
          )}

          {done && (
            <Alert>
              <AlertDescription>
                Importação concluída — os leads já estão na sua lista.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
