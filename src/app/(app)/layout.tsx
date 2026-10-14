import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ConfigPending } from "@/components/auth/config-pending";
import { isSupabaseConfigured } from "@/lib/env";
import { requireOrgContext } from "@/server/auth/session";

// Área autenticada — sempre renderizada por request (cookies de sessão).
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!isSupabaseConfigured() || !process.env.DATABASE_URL) {
    return <ConfigPending />;
  }

  const ctx = await requireOrgContext();

  return (
    <div className="min-h-screen">
      <AppSidebar role={ctx.membership.role} plan={ctx.organization.plan} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <AppTopbar
          organizationList={ctx.organizationList.map((o) => ({ id: o.id, name: o.name }))}
          activeOrgId={ctx.organization.id}
          userEmail={ctx.user.email}
          role={ctx.membership.role}
        />
        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">{children}</main>
      </div>

      <MobileNav />
    </div>
  );
}
