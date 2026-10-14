import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

/**
 * Rotas que exigem usuário autenticado.
 * Rotas públicas (/p/[slug] de captura, /go/[token] de redirect) ficam fora.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding", "/settings", "/invite"];
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  const { url, anonKey } = getSupabaseEnv();

  // Sem Supabase configurado, as próprias páginas exibem orientação.
  if (!url || !anonKey) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Refresh da sessão — essencial para tokens atualizados no server.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
  const isAuthRoute = AUTH_ROUTES.includes(path);

  if (!user && isProtected) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Protege tudo exceto:
     * - _next/static, _next/image (assets internos)
     * - favicon e imagens públicas
     * - /p/* (páginas de captura públicas — Phase 2)
     * - /go/* (redirects rastreados — Phase 3)
     * - /u/* (cancelamento de inscrição — Phase 6)
     */
    "/((?!_next/static|_next/image|p/|go/|u/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
