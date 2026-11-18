/**
 * Cliente Supabase del navegador
 * ==============================
 * Fase C-1. Usa SOLO las claves públicas: URL del proyecto y `anon key`
 * (que viaja al navegador por diseño y respeta RLS — verificado en F1:
 * `anon` solo tiene SELECT sobre las 6 tablas de catálogo).
 *
 * La `service_role key` NUNCA se usa aquí: vive solo en el servidor
 * (Route Handlers), jamás en el bundle del cliente.
 *
 * Variables (docs/TRANSICION_SUPABASE.md §7):
 *   - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (preferidas)
 *   - SUPABASE_URL / SUPABASE_ANON_KEY (compatibilidad con .env.local actual;
 *     en el bundle del cliente solo aplican si Next las inyecta, ojo)
 *
 * La validación es perezosa (al primer uso), no en import: así los tests
 * pueden importar el módulo sin claves y los builds con el flag en
 * "localStorage" no fallan por variables ausentes.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let missingReported = false;

// Next.js inyecta NEXT_PUBLIC_* en el bundle del cliente en tiempo de build.
// El acceso debe ser directo (process.env.NEXT_PUBLIC_X), no dinámico.
// Las constantes se evalúan al cargar el módulo; en tests (vi.stubEnv) se
// usan después, por eso también se lee process.env en tiempo de ejecución.
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ENV_DATA_BACKEND = process.env.NEXT_PUBLIC_DATA_BACKEND;
const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function readEnv(name: string): string | undefined {
  let direct: string | undefined;
  switch (name) {
    case "NEXT_PUBLIC_SUPABASE_URL":
      direct = ENV_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      break;
    case "NEXT_PUBLIC_SUPABASE_ANON_KEY":
      direct = ENV_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      break;
    case "NEXT_PUBLIC_DATA_BACKEND":
      direct = ENV_DATA_BACKEND || process.env.NEXT_PUBLIC_DATA_BACKEND;
      break;
    case "NEXT_PUBLIC_SITE_URL":
      direct = ENV_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
      break;
    default:
      direct = process.env[name];
  }
  if (direct && direct.trim() !== "") return direct.trim();
  // Fallback a los nombres sin prefijo (solo existe en el lado servidor).
  const legacy = process.env[name.replace(/^NEXT_PUBLIC_/, "")];
  return legacy && legacy.trim() !== "" ? legacy.trim() : undefined;
}

/** Claves públicas requeridas para el backend `supabase`. */
export function getSupabasePublicConfig(): { url: string; anonKey: string } {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !anonKey) {
    throw new Error(
      "Backend supabase seleccionado pero faltan NEXT_PUBLIC_SUPABASE_URL " +
        "(o SUPABASE_URL) y/o NEXT_PUBLIC_SUPABASE_ANON_KEY (o SUPABASE_ANON_KEY) " +
        "en el entorno. Completá .env.local (ver .env.example) o volvé " +
        "NEXT_PUBLIC_DATA_BACKEND a localStorage."
    );
  }
  return { url, anonKey };
}

/**
 * Cliente único (patrón singleton de supabase-js). Lanza con mensaje claro
 * si faltan las claves públicas.
 *
 * Autenticación (Supabase Auth):
 *  - `persistSession`/`autoRefreshToken` solo en el navegador: en el servidor
 *    (o en tests Node) no hay localStorage y el comportamiento es idéntico al
 *    anterior (sin sesión persistida).
 *  - `flowType: "implicit"`: los enlaces de email (confirmación de registro y
 *    recuperación de contraseña) traen el token en el fragmento `#...` de la
 *    URL, de modo que funcionan aunque el cliente abra el mail en OTRO
 *    dispositivo/navegador (con PKCE el flujo exige el mismo navegador).
 *  - `detectSessionInUrl`: al abrir un enlace de recuperación, la sesión se
 *    establece sola y la página /recuperar-password puede mostrar el form
 *    "elegir contraseña nueva".
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const { url, anonKey } = getSupabasePublicConfig();
  const isBrowser = typeof window !== "undefined";
  client = createClient(url, anonKey, {
    auth: {
      persistSession: isBrowser,
      autoRefreshToken: isBrowser,
      detectSessionInUrl: isBrowser,
      flowType: "implicit",
    },
  });
  return client;
}

/** Solo para tests: limpia el singleton. */
export function resetSupabaseForTests(): void {
  client = null;
  missingReported = false;
}

/** Diagnóstico usado por tests/informes: true si hay claves configuradas. */
export function hasSupabasePublicConfig(): boolean {
  try {
    getSupabasePublicConfig();
    return true;
  } catch {
    if (!missingReported && typeof console !== "undefined") {
      missingReported = true;
    }
    return false;
  }
}
