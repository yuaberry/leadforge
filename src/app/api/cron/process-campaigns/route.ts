import { NextResponse, type NextRequest } from "next/server";

import { and, eq } from "drizzle-orm";

import { getServiceDb } from "@/server/db/index";
import { campaigns } from "@/server/db/schema";
import { getEmailAccount } from "@/server/db/repositories/campaigns";
import { processCampaignBatch } from "@/server/services/campaign-runner";

/**
 * Cron de processamento de campanhas:
 *   POST/GET /api/cron/process-campaigns
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Percorre TODAS as campanhas ativas (cross-org — serviceDb DOCUMENTADO,
 * escopo manual por organization_id em cada query do runner).
 */
export const runtime = "nodejs";

async function runAllCampaigns(): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado" }, { status: 503 });
  }

  const db = getServiceDb();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const activeCampaigns = await db
    .select({ id: campaigns.id, organizationId: campaigns.organizationId })
    .from(campaigns)
    .where(and(eq(campaigns.status, "active"), eq(campaigns.channel, "email")))
    .limit(100);

  const results: Record<string, unknown>[] = [];

  for (const campaign of activeCampaigns) {
    const account = await getEmailAccount(db, campaign.organizationId);
    const report = await processCampaignBatch(
      db,
      {
        organizationId: campaign.organizationId,
        origin,
        fromAddress: account ? `${account.fromName} <${account.fromEmail}>` : null,
      },
      campaign.id,
      20
    );
    if (report.processed > 0 || report.skippedCap) {
      results.push({ campaignId: campaign.id, ...report });
    }
  }

  return NextResponse.json({ ok: true, campaigns: activeCampaigns.length, results });
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return runAllCampaigns();
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return runAllCampaigns();
}
