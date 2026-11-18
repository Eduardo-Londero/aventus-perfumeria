/**
 * Feature flag de backend de datos
 * ================================
 * `NEXT_PUBLIC_DATA_BACKEND` decide de dónde sale la información que hoy
 * sirve src/lib/db.ts:
 *
 *   - "localStorage" (POR DEFECTO): comportamiento actual, idéntico byte a byte.
 *   - "supabase": el driver lee del proyecto Supabase (lectura de catálogo,
 *     Fase C-1) y el catálogo escribe por /api/data/* (Fase C-2). Pedidos y
 *     secciones del home siguen bloqueados hasta F3 / Fase D.
 *
 * Es una constante inyectada en tiempo de build por Next.js (por eso el
 * prefijo NEXT_PUBLIC_). Un valor desconocido o vacío cae a "localStorage":
 * preferimos el comportamiento actual ante cualquier sorpresa.
 *
 * El corte es UN SOLO PUNTO: no existe mezcla de escrituras (nunca se escribe
 * en dos backend a la vez). Ver docs/TRANSICION_SUPABASE.md §5 y §8.
 */

export type DataBackend = "localStorage" | "supabase";

const DEFAULT_BACKEND: DataBackend = "localStorage";

/**
 * Resuelve el backend a partir del valor crudo de la variable de entorno.
 * - indefinido/vacío → "localStorage"
 * - "supabase" → "supabase"
 * - cualquier otra cosa → "localStorage" (valor inválido, degradación segura)
 */
export function resolveDataBackend(raw: string | undefined): DataBackend {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "supabase") return "supabase";
  if (value !== "" && value !== "localstorage") {
    // No lanzamos: un valor mal tipeado no debe tumbar la tienda entera.
    // El modo por defecto (localStorage) es siempre seguro.
    if (typeof console !== "undefined") {
      console.warn(
        `[dataBackend] NEXT_PUBLIC_DATA_BACKEND="${raw}" no es válido ` +
          `(esperado "localStorage" o "supabase"). Usando "${DEFAULT_BACKEND}".`
      );
    }
    return DEFAULT_BACKEND;
  }
  return DEFAULT_BACKEND;
}

// Next.js inyecta NEXT_PUBLIC_* en el bundle del cliente en tiempo de build.
// El acceso debe ser directo (process.env.NEXT_PUBLIC_X), no dinámico.
const ENV_DATA_BACKEND = process.env.NEXT_PUBLIC_DATA_BACKEND;

/** Backend efectivo en este build. */
export const DATA_BACKEND: DataBackend = resolveDataBackend(
  ENV_DATA_BACKEND || process.env.NEXT_PUBLIC_DATA_BACKEND
);

/** Atajo de comprobación usada por la capa de datos. */
export const IS_SUPABASE_BACKEND: boolean = DATA_BACKEND === "supabase";
