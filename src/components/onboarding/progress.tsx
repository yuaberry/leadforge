import { cn } from "@/lib/utils";

const STEPS = ["Organização", "Negócio", "Canais", "Meta", "Revisão"];

export function OnboardingProgress({ current }: { current: number }) {
  return (
    <ol className="mb-8 flex items-center justify-center gap-2 sm:gap-3" aria-label="Progresso do onboarding">
      {STEPS.map((label, index) => {
        const step = index + 1;
        const active = step === current;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-full border text-xs font-semibold",
                active && "border-primary bg-primary text-primary-foreground",
                done && "border-primary/50 bg-primary/15 text-primary",
                !active && !done && "border-border text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : step}
            </span>
            <span
              className={cn(
                "hidden text-xs font-medium sm:inline",
                active ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span className="hidden h-px w-4 bg-border sm:block" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
