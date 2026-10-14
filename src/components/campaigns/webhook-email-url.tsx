"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Exibe o path do webhook; completa com a origem após hidratar (sem mismatch). */
export function WebhookEmailUrl({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState(`/api/webhooks/email/resend?token=${token}`);

  useEffect(() => {
    setUrl(`${window.location.origin}/api/webhooks/email/resend?token=${token}`);
  }, [token]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-muted px-2 py-2 text-xs">
        {url}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="gap-1.5">
        {copied ? (
          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copiado" : "Copiar"}
      </Button>
    </div>
  );
}
