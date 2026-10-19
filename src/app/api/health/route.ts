import { NextResponse } from "next/server";

/**
 * Health check — identifica o LeadForge para o app desktop (Electron).
 * O Electron verifica esta rota antes de abrir a janela, garantindo
 * que está conectando no LeadForge (e não em outra app na mesma porta).
 */
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    app: "leadforge",
    name: "LeadForge",
    version: "1.0.0",
    tagline: "Find. Qualify. Personalize. Convert.",
  });
}
