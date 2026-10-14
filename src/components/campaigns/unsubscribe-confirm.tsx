"use client";

import { useState, useTransition } from "react";

import { confirmUnsubscribeAction } from "@/app/u/[token]/actions";
import { Button } from "@/components/ui/button";

export function UnsubscribeConfirm({ token }: { token: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<{ ok: boolean } | null>(null);

  function confirm() {
    startTransition(async () => {
      const result = await confirmUnsubscribeAction(token);
      setState(result);
    });
  }

  if (state?.ok) {
    return (
      <div className="mt-6">
        <p className="text-sm font-medium text-emerald-400">
          Inscrição cancelada. Você não receberá mais e-mails. ✅
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-2">
      {state && !state.ok && (
        <p className="text-xs text-destructive" role="alert">
          {`Não foi possível confirmar. Tente novamente.`}
        </p>
      )}
      <Button onClick={confirm} disabled={pending} className="w-full">
        {pending ? "Confirmando..." : "Sim, cancelar minha inscrição"}
      </Button>
    </div>
  );
}
