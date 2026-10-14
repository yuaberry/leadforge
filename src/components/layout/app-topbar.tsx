import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ORG_ROLES, type MemberRoleKey } from "@/lib/constants";

import { OrgSwitcher } from "./org-switcher";

export function AppTopbar({
  organizationList,
  activeOrgId,
  userEmail,
  role,
}: {
  organizationList: { id: string; name: string }[];
  activeOrgId: string;
  userEmail?: string;
  role: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <OrgSwitcher organizations={organizationList} activeId={activeOrgId} />
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {ORG_ROLES[role as MemberRoleKey] ?? role}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="hidden max-w-48 truncate text-sm text-muted-foreground md:inline">
              {userEmail}
            </span>
          )}
          <form action={signOutAction}>
            <Button variant="ghost" size="sm" type="submit" className="gap-2">
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
