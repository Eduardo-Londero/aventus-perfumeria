import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/session";

/**
 * Guardia server-side del panel de administración.
 * ================================================
 * Antes, /admin solo se protegía en el cliente (redirección desde el layout),
 * lo que permitía acceder al HTML/JS del panel sin sesión. Ahora el servidor
 * verifica la cookie firmada antes de servir cualquier ruta /admin.
 *
 * Nota de alcance: esto protege el ACCESO A LAS RUTAS. Las mutaciones de datos
 * siguen siendo locales (localStorage) hasta la migración a Supabase, donde el
 * aislamiento real lo aportarán RLS + privilegios (migraciones 0002/0003).
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);

  if (session && session.role === "admin") {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  loginUrl.searchParams.set("reason", token ? "session_expired" : "login_required");
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
