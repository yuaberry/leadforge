import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LeadForge — Find. Qualify. Personalize. Convert.",
    template: "%s · LeadForge",
  },
  description:
    "Plataforma de inteligência comercial e conquista financeira digital: venda produtos autorais ou de afiliado em escala, com IA, campanhas, lucro em tempo real e metas gamificadas.",
  keywords: ["prospecção", "afiliados", "produtos digitais", "CRM", "vendas", "IA"],
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-screen font-sans`}>
        {children}
      </body>
    </html>
  );
}
