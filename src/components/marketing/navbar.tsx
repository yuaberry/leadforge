import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <a href="#recursos" className="transition-colors hover:text-foreground">
            Recursos
          </a>
          <a href="#como-funciona" className="transition-colors hover:text-foreground">
            Como funciona
          </a>
          <a href="#lucro" className="transition-colors hover:text-foreground">
            Lucro & Metas
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Entrar</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Criar conta</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
