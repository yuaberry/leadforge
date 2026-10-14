import { CircleAlert } from "lucide-react";

import { CONFIG_PENDING_MESSAGE } from "@/lib/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Estado real e honesto: Supabase não configurado neste ambiente. */
export function ConfigPending() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="max-w-lg border-white/10 bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CircleAlert className="size-5 text-amber-400" aria-hidden="true" />
            Configuração pendente
          </CardTitle>
          <CardDescription>A área autenticada requer um projeto Supabase.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{CONFIG_PENDING_MESSAGE}</p>
          <p>
            1. Crie um projeto gratuito em <span className="text-foreground">database.new</span>
            <br />
            2. Ative e-mail/senha em <span className="text-foreground">Authentication → Providers</span>
            <br />
            3. Copie as variáveis para <span className="text-foreground">.env.local</span> (veja .env.example)
            <br />
            4. Aplique as migrations: <span className="text-foreground">bun run db:migrate</span>
            <br />
            5. Reinicie: <span className="text-foreground">bun run dev</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
