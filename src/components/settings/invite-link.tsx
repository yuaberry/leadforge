"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — o usuário pode copiar manualmente.
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <code className="max-w-56 truncate rounded bg-muted px-2 py-1 text-xs">
        /invite/{token.slice(0, 12)}…
      </code>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyLink}
        className="gap-1.5"
        aria-label="Copiar link do convite"
      >
        {copied ? (
          <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copiado" : "Copiar link"}
      </Button>
    </div>
  );
}
