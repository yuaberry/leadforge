"use server";

import { headers as nextHeaders } from "next/headers";

import { getServiceDb } from "@/server/db/index";
import {
  getOrCreateSource,
  recordActivity,
  upsertLead,
} from "@/server/db/repositories/leads";
import {
  getPublishedPageBySlug,
  recordCaptureSubmission,
} from "@/server/db/repositories/capture";
import { clientIpFromHeaders, rateLimit } from "@/server/security/rate-limit";
import { captureSubmissionSchema } from "@/validators/capture";

export type CaptureSubmitResult =
  | { ok: true; thankYouMessage: string | null; leadMagnetUrl: string | null }
  | { ok: false; error: string };

/**
 * Submissão pública do formulário de captura.
 *
 * Caminho privilegiado DOCUMENTADO (serviceDb — bypass intencional de RLS):
 * visitantes anônimos não têm claims; a proteção aqui é a validação Zod
 * estrita + honeypot + rate limit por IP. A gravação só ocorre para páginas
 * PUBLICADAS, e o consentimento fica registrado (LGPD).
 */
export async function submitCaptureFormAction(
  _prev: CaptureSubmitResult | null,
  formData: FormData
): Promise<CaptureSubmitResult> {
  const slug = String(formData.get("slug") ?? "");

  // Honeypot: bots preenchem o campo invisível — fingimos sucesso e descartamos.
  if (String(formData.get("hp_website") ?? "") !== "") {
    return { ok: true, thankYouMessage: null, leadMagnetUrl: null };
  }

  const parsed = captureSubmissionSchema.safeParse({
    slug,
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    consent: formData.get("consent") === "on" ? "on" : "",
    utm_source: String(formData.get("utm_source") ?? ""),
    utm_campaign: String(formData.get("utm_campaign") ?? ""),
    utm_content: String(formData.get("utm_content") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const headersList = await nextHeaders();
  const ip = clientIpFromHeaders(headersList);

  const pageLimit = rateLimit(`capture:${slug}:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!pageLimit.ok) {
    return { ok: false, error: "Muitos envios. Aguarde um minuto e tente novamente." };
  }
  const ipLimit = rateLimit(`capture-global:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!ipLimit.ok) {
    return { ok: false, error: "Muitos envios. Aguarde um minuto e tente novamente." };
  }

  try {
    const db = getServiceDb();

    const page = await getPublishedPageBySlug(db, slug);
    if (!page) {
      return { ok: false, error: "Esta página não está disponível." };
    }

    const source = await getOrCreateSource(
      db,
      page.organizationId,
      `Captura: ${page.title}`.slice(0, 200),
      "capture"
    );

    const { lead, created } = await upsertLead(
      db,
      page.organizationId,
      {
        contactName: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        sourceUrl: `/p/${slug}`,
      },
      {
        sourceId: source.id,
        sourceName: page.title,
        sourceType: "capture",
        legalBasis: "consent",
        consentStatus: "granted",
        extraMetadata: {
          capturePageId: page.id,
          utm: {
            source: parsed.data.utm_source || null,
            campaign: parsed.data.utm_campaign || null,
            content: parsed.data.utm_content || null,
          },
        },
      }
    );

    await recordCaptureSubmission(db, {
      organizationId: page.organizationId,
      capturePageId: page.id,
      leadId: lead.id,
      data: { name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null },
      ip,
      userAgent: headersList.get("user-agent"),
      utm: {
        source: parsed.data.utm_source || null,
        campaign: parsed.data.utm_campaign || null,
        content: parsed.data.utm_content || null,
      },
    });

    if (created) {
      await recordActivity(db, {
        organizationId: page.organizationId,
        type: "lead_captured",
        entityType: "lead",
        entityId: lead.id,
        metadata: { page: page.slug, utm: parsed.data.utm_campaign || null },
      });
    }

    return {
      ok: true,
      thankYouMessage: page.thankYouMessage,
      leadMagnetUrl: page.leadMagnetUrl,
    };
  } catch {
    return { ok: false, error: "Não foi possível registrar sua inscrição. Tente novamente." };
  }
}
