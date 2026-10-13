import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Fundo */}
      <div className="bg-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-blue-600/20 via-violet-500/10 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute left-1/2 top-[-180px] size-[420px] -translate-x-1/2 rounded-full bg-blue-500/15 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-32">
        <div className="animate-fade-in-up">
          <Badge variant="secondary" className="mb-6 gap-1.5 border-white/10 px-3 py-1">
            <span className="size-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
            Vendas digitais em escala · Kiwify · Kirvano · Hotmart
          </Badge>
        </div>

        <h1 className="animate-fade-in-up mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Venda em massa. Converta alto.
          <br />
          <span className="text-gradient">Conquiste o que sempre quis.</span>
        </h1>

        <p className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
          O LeadForge encontra e qualifica leads com IA, recomenda o produto certo do seu catálogo —
          autoral ou de afiliado — gera mensagens personalizadas e mostra cada real entrando,
          direto na sua meta.
        </p>

        <div className="animate-fade-in-up mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/signup">Criar minha conta grátis</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Já tenho conta</Link>
          </Button>
        </div>

        <p className="animate-fade-in-up mt-6 text-xs text-muted-foreground">
          LGPD-first · Somente APIs oficiais · Aprovação humana · Zero spam
        </p>
      </div>
    </section>
  );
}
