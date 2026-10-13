import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircleAlert, LogOut } from "lucide-react";

import { signOutAction } from "@/app/dashboard/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isSupabaseConfigured } from "@/lib/env";
import { getAuthenticatedUser } from "@/server/auth/server-client";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Página autenticada — sempre renderizada por request (cookies de sessão).
export const dynamic = "force-dynamic";

const PROXIMAS_ENTREGAS = [
  "Organizações, membros e RBAC com Row Level Security",
  "Onboarding do seu negócio digital + primeira meta",
  "Captura de leads com páginas públicas e consentimento",
];

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-lg border-white/10 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CircleAlert className="size-5 text-amber-400" aria-hidden="true" />
              Configuração pendente
            </CardTitle>
            <CardDescription>A autenticação requer um projeto Supabase.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              1. Crie um projeto gratuito em{" "}
              <span className="text-foreground">database.new</span> (Supabase)
              <br />
              2. Ative a autenticação por e-mail/senha em{" "}
              <span className="text-foreground">Authentication → Providers</span>
              <br />
              3. Copie as variáveis de ambiente para{" "}
              <span className="text-foreground">.env.local</span> (veja .env.example)
              <br />
              4. Reinicie o servidor com <span className="text-foreground">bun run dev</span>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative min-h-screen">
      <div className="bg-grid absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4">
        <Card className="border-white/10 bg-card/80 backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">
                Bem-vindo,{" "}
                <span className="text-gradient">
                  {(user.user_metadata?.full_name as string | undefined) ?? user.email}
                </span>
              </CardTitle>
              <Badge variant="secondary">Fase 0</Badge>
            </div>
            <CardDescription>
              Sua conta está autenticada e funcionando. A montanha vem aí.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTitle>Próxima entrega — Phase 1</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1">
                  {PROXIMAS_ENTREGAS.map((entrega) => (
                    <li key={entrega}>• {entrega}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>

            <form action={signOutAction}>
              <Button variant="outline" type="submit" className="gap-2">
                <LogOut className="size-4" aria-hidden="true" />
                Sair
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
