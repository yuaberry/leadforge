import "server-only";

import { cookies } from "next/headers";

import { ACTIVE_ORG_COOKIE } from "@/lib/constants";

/** Grava a organização ativa (cookie httpOnly). */
export async function setActiveOrgCookie(organizationId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
