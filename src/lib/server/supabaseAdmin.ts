/**
 * Cliente Supabase del servidor con service_role (Fase C-2)
 * =========================================================
 * EXCLUSIVO del servidor: lo consumen los Route Handlers de /api/data/*.
 * El módulo aborta si se lo importa en el navegador (defensa en profundidad:
 * la `service_role key` jamás llega al bundle del cliente, ya que Next no la
 * inyecta sin prefijo NEXT_PUBLIC_ y aquí se exige explícitamente).
 *
 * La clave `service_role` es BYPASSRLS: por eso TODA escritura pasa antes por
 * la cookie de sesión de administrador (src/lib/server/adminGuard.ts) y por la
 * validación de src/lib/server/catalogWriteService.ts. No es una API pública:
 * es la capa de persistencia del propio panel.
 *
 * Variables (docs/TRANSICION_SUPABASE.md §7):
 *   - SUPABASE_SERVICE_ROLE_KEY (solo servidor, nunca NEXT_PUBLIC_)
 *   - SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL como respaldo)
 *
 * La validación es perezosa (al primer uso) para no romper el build por defecto.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ConfigError } from "@/lib/server/apiError";

let client: SupabaseClient | null = null;

function readServerEnv(name: string): string | undefined {
  // Los nombres sin prefijo son los de .env.local; se acepta también el
  // NEXT_PUBLIC_ solo como respaldo para URL/anon (nunca para la clave secreta).
  const direct = process.env[name];
  if (direct && direct.trim() !== "") return direct.trim();
  const public_ = process.env[`NEXT_PUBLIC_${name}`];
  if (public_ && public_.trim() !== "") return public_.trim();
  const bare = process.env[name.replace(/^NEXT_PUBLIC_/, "")];
  return bare && bare.trim() !== "" ? bare.trim() : undefined;
}

/** URL + service_role. Lanza ConfigError (503) si falta algo. */
export function getSupabaseAdminConfig(): { url: string; serviceRoleKey: string } {
  if (typeof window !== "undefined") {
    throw new ConfigError(
      "El cliente con service_role solo existe en el servidor: jamás se usa en el navegador."
    );
  }

  const url = readServerEnv("SUPABASE_URL");
  const serviceRoleKey = readServerEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new ConfigError(
      "Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor. " +
        "Completá .env.local (ver .env.example) o volvé NEXT_PUBLIC_DATA_BACKEND a localStorage."
    );
  }

  return { url, serviceRoleKey };
}

/** Singleton (patrón supabase-js). Lanza ConfigError si falta configuración. */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const { url, serviceRoleKey } = getSupabaseAdminConfig();
  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "x-application-name": "aventus-admin-api" } },
  });
  return client;
}

/** Solo para tests: limpia el singleton. */
export function resetSupabaseAdminForTests(): void {
  client = null;
}
