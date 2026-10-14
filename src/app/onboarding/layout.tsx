import { ConfigPending } from "@/components/auth/config-pending";
import { Logo } from "@/components/layout/logo";
import { isSupabaseConfigured } from "@/lib/env";

// Fluxo autenticado — sempre renderizado por request (cookies de sessão).
export const dynamic = "force-dynamic";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured()) {
    return <ConfigPending />;
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center px-4 py-10">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-[-160px] size-[400px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mb-8">
        <Logo />
      </div>
      <main className="relative w-full max-w-2xl">{children}</main>
    </div>
  );
}
