/**
 * Guardas de las rutas /api/data/* (Fase C-2)
 * ===========================================
 * Dos frenos antes de tocar la base, en este orden:
 *
 *  1. `requireSupabaseBackend` — el endpoint solo escribe si el build corre
 *     con `NEXT_PUBLIC_DATA_BACKEND=supabase`. Mantiene el corte ÚNICO de
 *     escrituras: con el backend por defecto no existe escritura remota, ni
 *     por esta ruta ni por ninguna otra.
 *  2. `requireAdmin` — cookie de sesión de administrador firmada (HMAC) y sin
 *     vencer. La clave `service_role` es BYPASSRLS, así que esta verificación
 *     ES la autorización: sin sesión válida no hay escritura.
 *
 * `errorResponse` traduce cualquier error a JSON { ok:false, code, message }
 * para que src/lib/dataSync.ts pueda mostrar el mensaje al administrador.
 *
 * Seguridad de la sesión: cookie `httpOnly` + `SameSite=Lax` (el navegador no
 * la adjunta en peticiones cross-site) y bodies JSON (que fuerzan preflight
 * CORS, y esta API no habilita CORS). No se acepta ningún otro modo de auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { DATA_BACKEND } from "@/lib/dataBackend";
import {
  BackendNotActiveError,
  UnauthorizedError,
  isApiError,
} from "@/lib/server/apiError";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSession,
  type AdminSessionPayload,
} from "@/lib/session";

/**
 * Devuelve `null` si el build corre con el backend remoto; si no, la respuesta
 * 409 lista para devolver.
 */
export function requireSupabaseBackend(): NextResponse | null {
  if (DATA_BACKEND === "supabase") return null;
  const error = new BackendNotActiveError();
  return errorResponse(error);
}

/**
 * Verifica la sesión de administrador. Devuelve el payload o la respuesta 401
 * (así la ruta puede hacer `if (guard instanceof NextResponse) return guard`).
 */
export async function requireAdmin(
  req: NextRequest
): Promise<AdminSessionPayload | NextResponse> {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const payload = await verifyAdminSession(token);
  if (!payload) {
    return errorResponse(new UnauthorizedError());
  }
  return payload;
}

/** Respuesta JSON de error coherente para cualquier `unknown`. */
export function errorResponse(error: unknown): NextResponse {
  if (isApiError(error)) {
    return NextResponse.json(
      { ok: false, code: error.code, message: error.message },
      { status: error.status }
    );
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const shaped = error as { code: string; status: number; message?: string };
    return NextResponse.json(
      {
        ok: false,
        code: shaped.code,
        message: shaped.message ?? "Error en la petición.",
      },
      { status: shaped.status }
    );
  }

  if (typeof console !== "undefined") {
    console.error("[api/data] error no controlado:", error);
  }
  return NextResponse.json(
    {
      ok: false,
      code: "INTERNAL",
      message: "Error interno al escribir en la base de datos.",
    },
    { status: 500 }
  );
}
