/**
 * Driver de almacenamiento de la capa de datos
 * ============================================
 * Punto de inyección único del feature flag `NEXT_PUBLIC_DATA_BACKEND`:
 * src/lib/db.ts conserva TODA su lógica (CRUD, validaciones, máquina de
 * estados, reserva/liberación de stock) y solo delega la persistencia en el
 * driver activo. La interfaz de db.ts NO cambia: `getAll()`, `create()`,
 * `updateStatus()`… siguen siendo síncronos como hasta hoy.
 *
 *   - local     → localStorage, comportamiento actual idéntico (por defecto).
 *   - supabase  → espejo en memoria hidratado de forma asíncrona al arrancar
 *                 (Fase C-1: lectura del catálogo). Las ESCRITURAS de catálogo
 *                 no pasan por acá: las hace db.ts con write-through optimista
 *                 hacia /api/data/* (Fase C-2); pedidos y home siguen bloqueados.
 *
 * Semántica de "listo":
 *   - local: siempre (whenReady() ya resuelto).
 *   - supabase: se resuelve cuando la hidratación termina (éxito o error);
 *     ante error la app sigue con la semilla local y `getLastError()` lo
 *     registra (degradación controlada, no pantalla roja).
 */

import {
  IS_SUPABASE_BACKEND,
  type DataBackend,
} from "@/lib/dataBackend";

export interface DbDriver {
  readonly name: DataBackend;
  /** Lectura síncrona (devuelve copia, como el parse del localStorage). */
  get<T>(key: string): T[];
  /** Escritura síncrona sobre el almacén activo. */
  set<T>(key: string, data: T[]): void;
  /** Arranque idempotente: en supabase lanza la hidratación. */
  initialize(): void;
  /** Resuelve cuando el driver puede servir datos reales (o degradó). */
  whenReady(): Promise<void>;
  /** Último error de hidratación (null si no hubo). Solo diagnóstico. */
  getLastError(): Error | null;
}

// ---------------------------------------------------------------------------
// Driver local (localStorage) — réplica exacta del comportamiento actual
// ---------------------------------------------------------------------------

export function createLocalDriver(): DbDriver {
  return {
    name: "localStorage",
    get<T>(key: string): T[] {
      if (typeof window === "undefined") return [];
      try {
        const data = localStorage.getItem(key);
        return data ? (JSON.parse(data) as T[]) : [];
      } catch {
        return [];
      }
    },
    set<T>(key: string, data: T[]): void {
      if (typeof window === "undefined") return;
      localStorage.setItem(key, JSON.stringify(data));
    },
    initialize(): void {
      // La siembra vive en initializeDatabase() (src/lib/db.ts), igual que hoy.
    },
    whenReady(): Promise<void> {
      return Promise.resolve();
    },
    getLastError(): Error | null {
      return null;
    },
  };
}

// ---------------------------------------------------------------------------
// Driver Supabase (Fase C-1: hidratación de solo lectura)
// ---------------------------------------------------------------------------

export type CatalogLoader = () => Promise<{
  genders: unknown[];
  categories: unknown[];
  brands: unknown[];
  products: unknown[];
}>;

/** Claves de colección que este driver puede hidratar (todas menos pedidos/CMS). */
const HYDRATABLE_KEYS: Array<{
  key: string;
  pick: (payload: Awaited<ReturnType<CatalogLoader>>) => unknown[];
}> = [
  { key: "aventus-db-genders", pick: (p) => p.genders },
  { key: "aventus-db-categories", pick: (p) => p.categories },
  { key: "aventus-db-brands", pick: (p) => p.brands },
  { key: "aventus-db-products", pick: (p) => p.products },
];

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSupabaseDriver(loader: CatalogLoader): DbDriver {
  const memory = new Map<string, unknown[]>();
  let started = false;
  let lastError: Error | null = null;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  return {
    name: "supabase",
    get<T>(key: string): T[] {
      const value = memory.get(key);
      return value ? (deepCopy(value) as T[]) : [];
    },
    set<T>(key: string, data: T[]): void {
      memory.set(key, deepCopy(data));
    },
    initialize(): void {
      if (started) return;
      started = true;

      loader()
        .then((payload) => {
          for (const { key, pick } of HYDRATABLE_KEYS) {
            const rows = pick(payload);
            // Si el remoto vino vacío, NO se pisa la semilla local: es el
            // mismo criterio "si está vacío, sembrar" de initializeDatabase.
            if (rows.length > 0) memory.set(key, deepCopy(rows));
          }
        })
        .catch((error: unknown) => {
          lastError =
            error instanceof Error ? error : new Error(String(error));
          // Degradación: quedan los datos sembrados en memoria y el error
          // queda registrado; la tienda no se rompe por una red caída.
          console.error(
            "[data-backend=supabase] hidratación fallida; se conserva la semilla local:",
            lastError.message
          );
        })
        .finally(() => resolveReady());
    },
    whenReady(): Promise<void> {
      return ready;
    },
    getLastError(): Error | null {
      return lastError;
    },
  };
}

// ---------------------------------------------------------------------------
// Selector (singleton por build)
// ---------------------------------------------------------------------------

let driver: DbDriver | null = null;

export function getDriver(): DbDriver {
  if (driver) return driver;
  driver = IS_SUPABASE_BACKEND
    ? createSupabaseDriver(() => import("@/lib/supabaseCatalog").then((m) => m.fetchCatalog()))
    : createLocalDriver();
  return driver;
}

/** Solo para tests: fuerza un driver inyectado (o null para volver al flag). */
export function setDriverForTests(next: DbDriver | null): void {
  driver = next;
}
