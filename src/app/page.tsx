import Link from "next/link";

import { Features } from "@/components/marketing/features";
import { Footer } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Navbar } from "@/components/marketing/navbar";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-600/15 via-violet-500/10 to-cyan-400/10 p-10 text-center sm:p-16">
            <div className="bg-grid absolute inset-0 opacity-50" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Pronto para <span className="text-gradient">forjar</span> suas vendas?
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
                Crie sua conta, conecte seu checkout e comece a transformar leads em comissões —
                e comissões em conquistas.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link href="/signup">Começar agora</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">Entrar</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
