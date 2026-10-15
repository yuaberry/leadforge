import { NextResponse, type NextRequest } from "next/server";

import { withTenantDb } from "@/server/db/tenant";
import { leadsOverviewCounts, listLeads } from "@/server/db/repositories/leads";
import { salesTotals } from "@/server/db/repositories/commerce";
import { financialTotals } from "@/server/db/repositories/crm";

/**
 * Exportação de dados da org (spec §20 + LGPD direito de acesso):
 *   GET /api/export/leads?format=csv|json
 *
 * Autenticado via cookie de sessão (middleware protege a rota) e escopado
 * pela RLS da org ativa.
 */
export const runtime = "nodejs";

function toCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
}

export async function GET(request: NextRequest) {
  const format = request.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";

  const { requireOrgContext } = await import("@/server/auth/session");
  const ctx = await requireOrgContext();

  const exportData = await withTenantDb(ctx.accessToken, async (db) => {
    const { items } = await listLeads(db, ctx.organization.id, { page: 1, pageSize: 5000 });
    const [sales, finance, stages] = await Promise.all([
      salesTotals(db, ctx.organization.id),
      financialTotals(db, ctx.organization.id),
      leadsOverviewCounts(db, ctx.organization.id),
    ]);
    return { leads: items, sales, finance, stages };
  });

  if (format === "csv") {
    const csv = toCsv(
      exportData.leads.map((lead) => ({
        id: lead.id,
        nome: lead.contactName ?? "",
        email: lead.email ?? "",
        telefone: lead.phone ?? "",
        empresa: lead.companyName ?? "",
        cidade: lead.cityName ?? "",
        estado: lead.stateName ?? "",
        estagio: lead.stage,
        score: lead.score ?? "",
        consentimento: lead.consentStatus,
        criado_em: lead.createdAt,
      }))
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leadforge-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      organization: { id: ctx.organization.id, name: ctx.organization.name },
      exportedAt: new Date().toISOString(),
      summary: { sales: exportData.sales, finance: exportData.finance, stages: exportData.stages },
      leads: exportData.leads,
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="leadforge-leads-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    }
  );
}
