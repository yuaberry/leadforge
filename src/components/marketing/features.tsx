import { Inbox, Package, Send, Sparkles, Target, TrendingUp } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Product Hub",
    description:
      "Produtos autorais ou de afiliado, de qualquer categoria, integrados aos seus checkouts. A IA vende o que você escolher.",
  },
  {
    icon: Sparkles,
    title: "IA de vendas",
    description:
      "Análise de cada lead separando fatos, inferências e hipóteses. Nada de achismo — o produto certo para cada pessoa.",
  },
  {
    icon: Send,
    title: "Campanhas com follow-up",
    description:
      "Sequências de e-mail e WhatsApp com etapas, esperas e limites de frequência. Aprovação humana sempre disponível.",
  },
  {
    icon: TrendingUp,
    title: "Lucro em tempo real",
    description:
      "Vendas da Kiwify e Kirvano entram sozinhas via webhook. Comissões, custos de tráfego e ROI real por campanha.",
  },
  {
    icon: Target,
    title: "Metas & Sonhos",
    description:
      "Cada venda aproxima você do que sempre quis: notebook, carro, viagem. A barra de progresso sobe sozinha.",
  },
  {
    icon: Inbox,
    title: "CRM + Inbox unificada",
    description:
      "Pipeline drag-and-drop, tarefas e todas as respostas de e-mail e WhatsApp num só lugar. Nada fica perdido.",
  },
];

export function Features() {
  return (
    <section id="recursos" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mb-12 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          A máquina completa de <span className="text-gradient">vendas digitais</span>
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Da captação do lead à comissão caindo na sua conta — com inteligência em cada etapa.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group rounded-xl border bg-card/60 p-6 transition-all hover:border-primary/40 hover:bg-card"
          >
            <div className="mb-4 inline-flex rounded-lg bg-gradient-to-br from-blue-500/15 via-violet-500/15 to-cyan-400/15 p-2.5 text-blue-400 transition-colors group-hover:text-cyan-300">
              <feature.icon className="size-5" aria-hidden="true" />
            </div>
            <h3 className="mb-2 font-semibold">{feature.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
