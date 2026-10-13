import { Logo } from "@/components/layout/logo";

export function Footer() {
  return (
    <footer className="border-t border-white/5 py-10">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 sm:px-6">
        <Logo />
        <p className="text-sm text-muted-foreground">
          Find. Qualify. Personalize. Convert.
        </p>
        <p className="text-xs text-muted-foreground">
          © 2026 LeadForge · Yua Devs · Feito para quem quer conquistar mais.
        </p>
      </div>
    </footer>
  );
}
