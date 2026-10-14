"use client";

import { setActiveOrganizationAction } from "@/app/actions";

export function OrgSwitcher({
  organizations,
  activeId,
}: {
  organizations: { id: string; name: string }[];
  activeId: string;
}) {
  if (organizations.length <= 1) {
    return <span className="text-sm font-medium">{organizations[0]?.name}</span>;
  }

  return (
    <form action={setActiveOrganizationAction}>
      <select
        name="organizationId"
        defaultValue={activeId}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        aria-label="Trocar organização"
        className="max-w-48 truncate rounded-md border border-input bg-secondary px-2 py-1.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </form>
  );
}
