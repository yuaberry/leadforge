import type { Metadata } from "next";
import { CircleCheck, CircleAlert } from "lucide-react";

import { UnsubscribeConfirm } from "@/components/campaigns/unsubscribe-confirm";
import { verifyUnsubscribeToken } from "@/server/services/unsubscribe";

export const metadata: Metadata = {
  title: "Cancelar inscrição",
};

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = verifyUnsubscribeToken(token);

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-card/80 p-8 text-center backdrop-blur">
        {payload ? (
          <>
            <CircleCheck className="mx-auto size-12 text-amber-400" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold">Cancelar inscrição</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Confirme abaixo para não receber mais e-mails de{" "}
              <span className="text-foreground">{payload.email}</span>.
            </p>
            <UnsubscribeConfirm token={token} />
          </>
        ) : (
          <>
            <CircleAlert className="mx-auto size-12 text-muted-foreground" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold">Link inválido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Este link de cancelamento não é válido ou foi adulterado.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
