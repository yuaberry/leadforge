/** Constantes compartilhadas entre server e client. */

export const ACTIVE_ORG_COOKIE = "lf_active_org";
export const ORG_ROLES = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
  viewer: "Leitor",
} as const;

export type MemberRoleKey = keyof typeof ORG_ROLES;
