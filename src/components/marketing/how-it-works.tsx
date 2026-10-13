import { LineChart, Magnet, MessageSquareText, Trophy } from "lucide-react";

const steps = [
  {
    icon: Magnet,
    title: "1. Capture audiência",
    description:
      "Páginas de captura com consentimento LGPD, importação com proveniência declarada e descoberta via fontes autorizadas.",
  },
  {
    icon: LineChart,
    title: "2. Qualifique com IA",
    description:
      "Score configurável, análise que separa fatos de hipóteses e recomendação do produto certo do seu catálogo.",
  },
  {
    icon: MessageSquareText,
    title: "3. Converta em escala",
    description:
      "Mensagens personalizadas com link de checkout rastreado e sequências de follow-up até a venda.",
  },
  {
    icon: Trophy,
    title: "4. Conquiste",
    description:
      "A venda entra via webhook, o lucro atualiza na hora e a sua meta enche — barra subindo a cada comissão.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      className="border-y border-white/5 bg-card/30 py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-12 text-center">
          <h2 id="lucro" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Do lead ao lucro. Do lucro ao <span className="text-gradient">sonho</span>.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Um fluxo fechado: cada etapa alimenta a próxima.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.title} className="rounded-xl border bg-card p-6">
              <step.icon className="mb-4 size-6 text-cyan-300" aria-hidden="true" />
              <h3 className="mb-2 font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
