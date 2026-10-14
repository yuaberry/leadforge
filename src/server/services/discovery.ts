import "server-only";

import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "@/server/db/schema";
import { getOrCreateSource, upsertCompany, upsertCompanyLead } from "@/server/db/repositories/leads";
import { getSourceProvider } from "@/server/providers/sources";
import type { CompanySearchQuery } from "@/server/providers/sources/types";

type AnyDb = NodePgDatabase<typeof schema>;

export type DiscoveryReport = {
  provider: "google_places" | "mock";
  found: number;
  companiesCreated: number;
  companiesUpdated: number;
  leadsCreated: number;
  leadsExisting: number;
  opportunitiesWithoutWebsite: number;
  sampleCompanies: { name: string; hasWebsite: boolean; rating: number | null }[];
};

/**
 * Pipeline de discovery (canal B2B local):
 *   searchCompanies (API oficial/mock) → normalização (upsertCompany com
 *   dedup por external_id/domínio/fone/hash) → lead por empresa
 *   (legítimo interesse, listagem pública via API oficial) → score.
 */
export async function runDiscovery(
  db: AnyDb,
  input: {
    organizationId: string;
    query: CompanySearchQuery;
    orgCategories: string[];
    scoreWeights: Record<string, number>;
  }
): Promise<DiscoveryReport> {
  const provider = getSourceProvider();
  const { companies: raw } = await provider.searchCompanies(input.query);

  const source = await getOrCreateSource(db, input.organizationId, "Google Places", "discovery");

  const report: DiscoveryReport = {
    provider: process.env.GOOGLE_PLACES_API_KEY ? "google_places" : "mock",
    found: raw.length,
    companiesCreated: 0,
    companiesUpdated: 0,
    leadsCreated: 0,
    leadsExisting: 0,
    opportunitiesWithoutWebsite: 0,
    sampleCompanies: [],
  };

  for (const rawCompany of raw) {
    const { company, created } = await upsertCompany(
      db,
      input.organizationId,
      {
        name: rawCompany.name,
        website: rawCompany.website,
        phone: rawCompany.phone,
        category: rawCompany.category,
        addressLine: rawCompany.address,
        externalId: rawCompany.externalId,
        rating: rawCompany.rating,
        userRatingCount: rawCompany.userRatingCount,
      },
      source.id
    );

    if (created) report.companiesCreated++;
    else report.companiesUpdated++;

    if (!company.website) report.opportunitiesWithoutWebsite++;

    const leadResult = await upsertCompanyLead(db, input.organizationId, company.id, {
      sourceId: source.id,
      sourceName: "Google Places",
      orgCategories: input.orgCategories,
      scoreWeights: input.scoreWeights,
    });

    if (leadResult.created) report.leadsCreated++;
    else report.leadsExisting++;

    if (report.sampleCompanies.length < 5) {
      report.sampleCompanies.push({
        name: company.name,
        hasWebsite: Boolean(company.website),
        rating: company.rating ?? null,
      });
    }
  }

  return report;
}
