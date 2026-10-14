import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Flame } from "lucide-react";

import { PublicCaptureForm } from "@/components/capture/public-capture-form";
import { getServiceDb } from "@/server/db/index";
import { getPublishedPageBySlug } from "@/server/db/repositories/capture";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;

  try {
    const db = getServiceDb();
    const page = await getPublishedPageBySlug(db, slug);
    if (!page) return { title: "Página não encontrada" };
    return {
      title: page.headline,
      description: page.subheadline ?? page.title,
    };
  } catch {
    return { title: "LeadForge" };
  }
}

export default async function PublicCapturePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  let page: Awaited<ReturnType<typeof getPublishedPageBySlug>> | null = null;
  try {
    const db = getServiceDb();
    page = await getPublishedPageBySlug(db, slug);
  } catch {
    // DATABASE_URL ausente — estado honesto
    return (
      <PublicShell>
        <p className="text-sm text-muted-foreground">
          Página indisponível no momento. Tente novamente mais tarde.
        </p>
      </PublicShell>
    );
  }

  if (!page) notFound();

  const utm = {
    source: typeof sp.utm_source === "string" ? sp.utm_source : undefined,
    campaign: typeof sp.utm_campaign === "string" ? sp.utm_campaign : undefined,
    content: typeof sp.utm_content === "string" ? sp.utm_content : undefined,
  };

  return (
    <PublicShell>
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {page.headline}
        </h1>
        {page.subheadline && (
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">{page.subheadline}</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-card/80 p-6 backdrop-blur sm:p-8">
        <PublicCaptureForm slug={page.slug} consentText={page.consentText} utm={utm} />
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        Seus dados são tratados conforme a LGPD. Cancelamento a qualquer momento.
      </p>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-[-180px] size-[420px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Flame className="size-4 text-blue-400" aria-hidden="true" />
         powered by LeadForge
        </div>
        {children}
      </div>
    </div>
  );
}
