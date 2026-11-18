/**
 * Exportación de respaldo (dump) — Fase D
 * =======================================
 * Construye el JSON que luego importa `scripts/import-to-supabase.mjs`
 * (validación, plan y upsert re-ejecutable). El formato es ESPEJO de ese
 * script: `DUMP_FORMAT`/`DUMP_VERSION` y la forma de `collections` deben
 * coincidir — la paridad se verifica con pruebas
 * (src/lib/importScript.parity.test.ts).
 *
 *   - `buildDump` es PURO: recibe las colecciones y devuelve el objeto dump
 *     (sin I/O), por eso es testeable en Node.
 *   - `collectCollections` y `downloadDump` son helpers de navegador (la
 *     exportación se dispara desde Admin → Configuración).
 *
 * El dump conserva TODO (incluidos pedidos, home y carrito): son datos del
 * propietario que el script de importación decide cuáles escribir y cuáles
 * dejar preservados (ver SKIPPED en el script).
 */

import type {
  Brand,
  Category,
  CartItem,
  Gender,
  Order,
  Product,
} from "@/types";
import type { HomepageSection } from "@/types/cms";
import { DATA_BACKEND, type DataBackend } from "@/lib/dataBackend";

// Espejo de scripts/import-to-supabase.mjs
export const DUMP_FORMAT = "aventus-dump";
export const DUMP_VERSION = 1;

export interface DumpCollections {
  products: Product[];
  categories: Category[];
  brands: Brand[];
  genders: Gender[];
  orders: Order[];
  homeSections: HomepageSection[];
  cart: CartItem[];
}

export interface DumpCounts {
  products: number;
  categories: number;
  brands: number;
  genders: number;
  orders: number;
  homeSections: number;
  cart: number;
}

export interface Dump {
  format: typeof DUMP_FORMAT;
  version: typeof DUMP_VERSION;
  /** Momento de la exportación (ISO). */
  exportedAt: string;
  /** Backend activo al exportar (diagnóstico: localStorage = origen típico). */
  backend: DataBackend;
  counts: DumpCounts;
  collections: DumpCollections;
}

/** Claves de localStorage que alimentan el dump (documentadas en el plan). */
export const DUMP_STORAGE_KEYS = {
  products: "aventus-db-products",
  categories: "aventus-db-categories",
  brands: "aventus-db-brands",
  genders: "aventus-db-genders",
  orders: "aventus-db-orders",
  homeSections: "aventus-db-home-sections",
  cart: "aventus-cart",
} as const;

/** Colecciones vacías por defecto (un dump sobre una tienda recién sembrada). */
export function emptyCollections(): DumpCollections {
  return {
    products: [],
    categories: [],
    brands: [],
    genders: [],
    orders: [],
    homeSections: [],
    cart: [],
  };
}

/**
 * Construye el dump. Puro: no lee storage ni escribe nada. Las colecciones
 * faltantes (undefined/null) se tratan como vacías; las listas se copian
 * (deep) para que el dump no comparta referencias con el estado vivo.
 */
export function buildDump(
  collections: Partial<DumpCollections> | null | undefined,
  options: { exportedAt?: string; backend?: DataBackend } = {}
): Dump {
  const merged: DumpCollections = { ...emptyCollections(), ...(collections ?? {}) };
  const counts: DumpCounts = {
    products: merged.products.length,
    categories: merged.categories.length,
    brands: merged.brands.length,
    genders: merged.genders.length,
    orders: merged.orders.length,
    homeSections: merged.homeSections.length,
    cart: merged.cart.length,
  };

  return {
    format: DUMP_FORMAT,
    version: DUMP_VERSION,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    backend: options.backend ?? DATA_BACKEND,
    counts,
    // Deep copy: el dump queda congelado aunque el admin siga editando.
    collections: JSON.parse(JSON.stringify(merged)) as DumpCollections,
  };
}

/** true si el valor tiene la forma de un dump de esta versión. */
export function isDump(value: unknown): value is Dump {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<Dump>;
  return candidate.format === DUMP_FORMAT && candidate.version === DUMP_VERSION;
}

/** Línea de resumen legible para el toast del admin. */
export function describeDump(dump: Dump): string {
  const c = dump.counts;
  return (
    `${c.products} productos · ${c.categories} categorías · ${c.brands} marcas · ` +
    `${c.genders} géneros · ${c.orders} pedidos · ${c.homeSections} secciones de home · ` +
    `${c.cart} ítems de carrito`
  );
}

// ---------------------------------------------------------------------------
// Helpers de navegador (solo se usan desde componentes cliente)
// ---------------------------------------------------------------------------

/** Lee una colección de localStorage con la misma tolerancia que el driver. */
function readCollection<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(key);
    return data ? (JSON.parse(data) as T[]) : [];
  } catch {
    return [];
  }
}

/**
 * Lee las 7 colecciones desde el almacén del navegador (las 6 de
 * `aventus-db-*` + el carrito). Es la fuente histórica de los datos del
 * propietario: con el backend `localStorage` es exactamente lo que usa la
 * tienda; con `supabase` el catálogo vive en memoria y este snapshot refleja
 * lo último persistido localmente (se informa en `backend` del dump).
 */
export function collectCollections(): DumpCollections {
  return {
    products: readCollection<Product>(DUMP_STORAGE_KEYS.products),
    categories: readCollection<Category>(DUMP_STORAGE_KEYS.categories),
    brands: readCollection<Brand>(DUMP_STORAGE_KEYS.brands),
    genders: readCollection<Gender>(DUMP_STORAGE_KEYS.genders),
    orders: readCollection<Order>(DUMP_STORAGE_KEYS.orders),
    homeSections: readCollection<HomepageSection>(DUMP_STORAGE_KEYS.homeSections),
    cart: readCollection<CartItem>(DUMP_STORAGE_KEYS.cart),
  };
}

/** Dispara la descarga del dump como archivo JSON en el navegador. */
export function downloadDump(dump: Dump): string {
  const stamp = dump.exportedAt.slice(0, 10);
  const filename = `aventus-dump-${stamp}.json`;
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("La descarga solo está disponible en el navegador.");
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return filename;
}
