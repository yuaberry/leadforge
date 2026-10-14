"use server";

import { getServiceDb } from "@/server/db/index";
import {
  addSuppression,
  markLeadsOptedOutByEmail,
} from "@/server/db/repositories/campaigns";
import { recordActivity } from "@/server/db/repositories/leads";
import { verifyUnsubscribeToken } from "@/server/services/unsubscribe";
import { normalizeEmail } from "@/lib/format";

export type UnsubscribeState = { ok: boolean; error?: string };

export async function confirmUnsubscribeAction(token: string): Promise<UnsubscribeState> {
  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return { ok: false, error: "Link inválido ou expirado." };
  }

  try {
    const db = getServiceDb();
    const email = normalizeEmail(payload.email);

    // 1. suppression (nunca mais recebe nada da org)
    await addSuppression(db, {
      organizationId: payload.organizationId,
      emailNormalized: email,
      channel: "all",
      reason: "unsubscribe",
      note: "Cancelamento via link de e-mail",
    });

    // 2. opt-out nos leads com este e-mail (exclui de campanhas futuras)
    const affected = await markLeadsOptedOutByEmail(db, payload.organizationId, email);

    await recordActivity(db, {
      organizationId: payload.organizationId,
      type: "unsubscribed",
      entityType: "organization",
      entityId: payload.organizationId,
      metadata: { email, affectedLeads: affected },
    });

    return { ok: true };
  } catch {
    return { ok: false, error: "Não foi possível processar. Tente novamente." };
  }
}
