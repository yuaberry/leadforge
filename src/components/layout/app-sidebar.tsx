"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CircleDollarSign,
  Inbox,
  KanbanSquare,
  LayoutDashboard,
  Lock,
  Magnet,
  MessageCircle,
  Plug,
  Search,
  Send,
  Target,
  TrendingUp,
  Upload,
  UserRound,
  Users,
  Wallet,
  ListTodo,
  Settings,
  Sparkles,
} from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Operação",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox },
      { href: "/leads", label: "Leads", icon: UserRound },
      { href: "/companies", label: "Empresas", icon: Building2 },
      { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
      { href: "/tasks", label: "Tarefas", icon: ListTodo },
    ],
  },
  {
    label: "Dinheiro",
    items: [
      { href: "/products", label: "Produtos", icon: CircleDollarSign },
      { href: "/sales", label: "Vendas", icon: TrendingUp },
      { href: "/profit", label: "Lucro", icon: Wallet },
      { href: "/goals", label: "Metas", icon: Target },
    ],
  },
  {
    label: "Crescimento",
    items: [
      { href: "/campaigns", label: "Campanhas", icon: Send },
      { href: "/discovery", label: "Discovery", icon: Search },
      { href: "/integrations", label: "Integrações", icon: Plug },
      { href: "/capture", label: "Captura", icon: Magnet },
      { href: "/import", label: "Importar CSV", icon: Upload },
    ],
  },
  {
    label: "Configurações",
    items: [
      { href: "/settings/users", label: "Membros", icon: Users },
      { href: "/settings/email", label: "E-mail", icon: Inbox },
      { href: "/settings/whatsapp", label: "WhatsApp", icon: MessageCircle },
      { href: "/settings/suppression", label: "Suppression", icon: ListTodo },
      { href: "/settings/ai", label: "IA & Scoring", icon: Sparkles },
      { href: "/settings/organization", label: "Organização", icon: Settings },
    ],
  },
];

/** Estados futuros — exibidos honestamente como indisponíveis, com a fase do plano. */
const COMING_SOON: { label: string; phase: string; icon: typeof Inbox }[] = [];

export function AppSidebar({
  role,
  plan,
}: {
  role: string;
  plan: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Logo />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto p-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    )}
                  >
                    <item.icon className="size-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {COMING_SOON.length > 0 && (
          <div>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              Em breve
            </p>
            <div className="space-y-0.5">
              {COMING_SOON.map((item) => (
                <div
                  key={item.label}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-muted-foreground/40"
                  title={`Chega na ${item.phase}`}
                >
                  <Lock className="size-3.5" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                    {item.phase}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <div className="rounded-lg bg-sidebar-accent/50 p-3 text-xs">
          <p className="font-semibold capitalize">{plan}</p>
          <p className="mt-0.5 text-muted-foreground">Seu papel: {role}</p>
        </div>
      </div>
    </aside>
  );
}
