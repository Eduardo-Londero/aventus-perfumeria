/**
 * Tests de la capa de datos con NEXT_PUBLIC_DATA_BACKEND=supabase
 * ===============================================================
 * Cubren: arranque/hidratación, conservación de la semilla cuando el remoto
 * está vacío, degradación ante error de red, lecturas síncronas con copias,
 * y —desde la Fase C-2— el write-through del catálogo: cambio optimista en
 * memoria, cola hacia /api/data/*, rollback + notificación si el servidor
 * rechaza, y que pedidos/home sigan bloqueados (F3 / Fase D).
 *
 * Patrón: mismo stub de `window`/`localStorage` que db.orders.test.ts (los
 * guardas `typeof window` exigen window) + vi.resetModules() para que
 * dataBackend() relea el flag por test + mock del cargador del catálogo +
 * stub global de `fetch` para la cola de escrituras.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Product } from "@/types";
import { products as seedProducts } from "@/data/products";

// El mock se crea con vi.hoisted para que el módulo re-instanciado tras
// resetModules() siga apuntando al mismo objeto (mismas implementaciones).
const catalogMock = vi.hoisted(() => ({ fetchCatalog: vi.fn() }));
vi.mock("@/lib/supabaseCatalog", () => catalogMock);

const REMOTE_PRODUCT: Product = {
  id: "r1",
  slug: "remoto-sauvage",
  name: "Sauvage Remoto",
  brand: "dior",
  description: "Desde Supabase",
  price: 99000,
  images: ["https://img/r1.jpg"],
  categories: ["hombre"],
  gender: "hombre",
  size: "100 ml",
  concentration: "EDT",
  olfactoryFamily: "Fresco",
  notes: { top: [], heart: [], base: [] },
  stock: 3,
  featured: false,
  isActive: true,
  isOnSale: false,
  isNew: false,
  createdAt: "2026-10-18",
};

function payload(overrides: Partial<Record<string, unknown[]>> = {}) {
  return {
    genders: overrides.genders ?? [],
    categories: overrides.categories ?? [],
    brands: overrides.brands ?? [],
    products: overrides.products ?? [],
    homeSections: overrides.homeSections ?? [],
  };
}

/**
 * Importa la capa de datos fresca con el flag en "supabase".
 * (cada test necesita su propio módulo: el driver es singleton.)
 */
async function importDbAsSupabase() {
  vi.stubEnv("NEXT_PUBLIC_DATA_BACKEND", "supabase");
  vi.resetModules();
  const db = await import("@/lib/db");
  const dbDriver = await import("@/lib/dbDriver");
  const dataSync = await import("@/lib/dataSync");
  return { db, dbDriver, dataSync };
}

/** `fetch` global devolviendo 200, o una respuesta custom para simular rechazo. */
function stubFetch(
  respond?: (url: string, init: RequestInit) => Response
): ReturnType<typeof vi.fn> {
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const requestInit = init ?? {};
    if (respond) return respond(url, requestInit);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", impl);
  return impl;
}

beforeEach(() => {
  catalogMock.fetchCatalog.mockReset();
  vi.stubGlobal("window", globalThis);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("backend supabase — arranque e hidratación", () => {
  it("declara el backend activo y reemplaza la semilla con los datos remotos", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(
      payload({ products: [REMOTE_PRODUCT], genders: [{ id: "x", name: "X", isActive: true }] })
    );
    const { db } = await importDbAsSupabase();

    expect(db.getDataBackend()).toBe("supabase");

    db.initializeDatabase();
    // Antes de resolver: la siembra local está en memoria (comportamiento
    // inmediato idéntico al de siempre: nada de pantallas vacías).
    expect(db.dbProducts.getAll()).toHaveLength(seedProducts.length);

    await db.whenReady();

    expect(db.dbProducts.getAll()).toEqual([REMOTE_PRODUCT]);
    expect(db.dbGenders.getAll()).toEqual([
      { id: "x", name: "X", isActive: true },
    ]);
  });

  it("si el remoto viene vacío, conserva la semilla (criterio 'si vacío, sembrar')", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const { db } = await importDbAsSupabase();

    db.initializeDatabase();
    await db.whenReady();

    expect(db.dbProducts.getAll()).toHaveLength(seedProducts.length);
    expect(db.dbGenders.getAll().map((g) => g.id)).toEqual([
      "hombre",
      "mujer",
      "unisex",
    ]);
    expect(db.dbCategories.getAll().length).toBeGreaterThan(0);
    expect(db.dbBrands.getAll().length).toBeGreaterThan(0);
  });

  it("la hidratación fallida degrada: resuelve whenReady, conserva semilla y registra el error", async () => {
    catalogMock.fetchCatalog.mockRejectedValue(new Error("red caída"));
    const { db, dbDriver } = await importDbAsSupabase();

    db.initializeDatabase();
    await expect(db.whenReady()).resolves.toBeUndefined();

    expect(db.dbProducts.getAll()).toHaveLength(seedProducts.length);
    expect(dbDriver.getDriver().getLastError()?.message).toBe("red caída");
    expect(console.error).toHaveBeenCalled();
  });

  it("initializeDatabase es idempotente (el driver no se hidrata dos veces)", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const { db } = await importDbAsSupabase();

    db.initializeDatabase();
    db.initializeDatabase();
    await db.whenReady();

    expect(catalogMock.fetchCatalog).toHaveBeenCalledTimes(1);
  });
});

describe("backend supabase — lecturas síncronas", () => {
  it("los filtros de la capa siguen funcionando sobre lo hidratado", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(
      payload({
        products: [
          REMOTE_PRODUCT,
          { ...REMOTE_PRODUCT, id: "r2", slug: "inactivo", isActive: false },
        ],
      })
    );
    const { db } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    expect(db.dbProducts.getAll()).toHaveLength(2);
    expect(db.dbProducts.getActive()).toHaveLength(1);
    expect(db.dbProducts.getBySlug("remoto-sauvage")?.name).toBe("Sauvage Remoto");
    expect(db.dbProducts.search("remoto")).toHaveLength(1);
  });

  it("getAll devuelve copias: mutar el resultado no corrompe el almacén", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(
      payload({ products: [REMOTE_PRODUCT] })
    );
    const { db } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const view = db.dbProducts.getAll();
    view.pop();
    expect(db.dbProducts.getAll()).toHaveLength(1);
  });
});

describe("backend supabase — pedidos bloqueados, home escrito (Fase D)", () => {
  it("los pedidos siguen fallando en voz alta con mensaje accionable", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const { db } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const esperado = /todavía no está disponible/;
    expect(() => db.dbOrders.create({} as never)).toThrow(esperado);
    expect(() => db.dbOrders.update("AV-1", {})).toThrow(esperado);
    expect(() => db.dbOrders.updateStatus("AV-1", "confirmado")).toThrow(
      esperado
    );
    // Fase C-2: el mensaje aclara que el catálogo y el CMS sí escriben.
    expect(() => db.dbOrders.create({} as never)).toThrow(/catálogo sí escribe/);
  });

  it("dbHomeSections.save aplica en memoria y encola el PUT de la colección", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const fetchMock = stubFetch();
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const next = db
      .dbHomeSections.getDefaultSections()
      .map((section) =>
        section.id === "1" ? { ...section, isActive: false } : section
      );

    db.dbHomeSections.save(next);
    // Optimista: el panel ve el cambio sin esperar la red.
    expect(db.dbHomeSections.getAll()).toEqual(next);

    await dataSync.whenWritesSettled();

    const call = fetchMock.mock.calls.find(
      ([url]) => String(url) === "/api/data/home_sections"
    );
    expect(call).toBeTruthy();
    const init = (call?.[1] ?? {}) as RequestInit;
    expect(init.method).toBe("PUT");
    const body = JSON.parse(String(init.body)) as {
      sections: Array<{ id: string }>;
    };
    expect(body.sections).toHaveLength(next.length);
    expect(body.sections.map((s) => s.id)).toEqual(next.map((s) => s.id));
  });

  it("si el servidor rechaza el PUT, se restaura la lista anterior y se notifica", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const fetchMock = stubFetch(
      () =>
        new Response(
          JSON.stringify({ code: "VALIDATION", message: "Sección inválida." }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        )
    );
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const antes = db.dbHomeSections.getAll();
    db.dbHomeSections.save([]);
    await dataSync.whenWritesSettled();

    expect(db.dbHomeSections.getAll()).toEqual(antes);
    expect(dataSync.getLastWriteError()).toBe("Sección inválida.");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("los generadores y lecturas NO están bloqueados", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const { db } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    expect(db.generateProductId()).toBeTruthy();
    expect(db.dbProducts.generateSlug("Sauvage EDP 100")).toBe(
      "sauvage-edp-100"
    );
    expect(db.dbHomeSections.getDefaultSections().length).toBeGreaterThan(0);
    expect(db.dbHomeSections.getActiveSections().length).toBeGreaterThan(0);
  });
});

describe("backend supabase — escrituras de catálogo (Fase C-2)", () => {
  it("create aplica el cambio en memoria y encola el POST con la fila", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const fetchMock = stubFetch();
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const nuevo: Product = {
      ...REMOTE_PRODUCT,
      id: "nuevo-1",
      slug: "nuevo-producto",
      name: "Producto Nuevo",
    };
    db.dbProducts.create(nuevo);

    // Optimista: ya se ve en memoria antes de que responda el servidor.
    expect(db.dbProducts.getById("nuevo-1")?.name).toBe("Producto Nuevo");

    await dataSync.whenWritesSettled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/data/products");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({
      id: "nuevo-1",
      name: "Producto Nuevo",
    });
    expect(dataSync.getLastWriteError()).toBeNull();
  });

  it("update envía la fila completa y delete envía DELETE sin cuerpo", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(
      payload({ products: [REMOTE_PRODUCT] })
    );
    const fetchMock = stubFetch();
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    db.dbProducts.update("r1", { name: "Renombrado" });
    await dataSync.whenWritesSettled();
    db.dbProducts.delete("r1");
    await dataSync.whenWritesSettled();

    const [updateCall, deleteCall] = fetchMock.mock.calls as Array<
      [string, RequestInit]
    >;
    expect(updateCall[0]).toBe("/api/data/products/r1");
    expect(updateCall[1].method).toBe("PATCH");
    // PATCH manda el objeto COMPLETO (validación sobre el estado final).
    expect(JSON.parse(String(updateCall[1].body))).toMatchObject({
      id: "r1",
      name: "Renombrado",
      price: 99000,
    });
    expect(deleteCall[0]).toBe("/api/data/products/r1");
    expect(deleteCall[1].method).toBe("DELETE");
    expect(deleteCall[1].body).toBeUndefined();
  });

  it("si el servidor rechaza, revierte la fila y notifica el motivo", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            ok: false,
            code: "CONFLICT",
            message: "Ya existe un registro con ese identificador o slug.",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        )
    );
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const failures: string[] = [];
    dataSync.subscribeWriteFailure((failure) => failures.push(failure.message));

    const antes = db.dbProducts.getAll();
    db.dbProducts.create({ ...REMOTE_PRODUCT, id: "rechazado" });
    expect(db.dbProducts.getById("rechazado")).toBeDefined();

    await dataSync.whenWritesSettled();

    // Rollback: la fila desaparece de nuevo.
    expect(db.dbProducts.getById("rechazado")).toBeUndefined();
    expect(db.dbProducts.getAll()).toHaveLength(antes.length);
    expect(failures).toEqual([
      "Ya existe un registro con ese identificador o slug.",
    ]);
    expect(dataSync.getLastWriteError()).toMatch(/identificador o slug/);
  });

  it("el rollback de un update restaura SOLO la fila afectada", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(
      payload({ products: [REMOTE_PRODUCT] })
    );
    stubFetch(
      () =>
        new Response(JSON.stringify({ ok: false, message: "HTTP 500" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        })
    );
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    const original = db.dbProducts.getById("r1") as Product;
    db.dbProducts.update("r1", { name: "Cambiado", stock: 99 });

    await dataSync.whenWritesSettled();

    expect(db.dbProducts.getById("r1")).toEqual(original);
  });

  it("envía las operaciones en serie (una tras otra, nunca en paralelo)", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const trace: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        trace.push(`start ${method}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        trace.push(`end ${method}`);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      })
    );
    const { db, dataSync } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    db.dbProducts.create({ ...REMOTE_PRODUCT, id: "orden-1" });
    db.dbProducts.update("orden-1", { name: "Editado" });

    await dataSync.whenWritesSettled();

    expect(trace).toEqual([
      "start POST",
      "end POST",
      "start PATCH",
      "end PATCH",
    ]);
  });

  it("la validación local previa no llega a la red", async () => {
    catalogMock.fetchCatalog.mockResolvedValue(payload());
    const fetchMock = stubFetch();
    const { db } = await importDbAsSupabase();
    db.initializeDatabase();
    await db.whenReady();

    expect(() =>
      db.dbProducts.create({ ...REMOTE_PRODUCT, id: "  " })
    ).toThrow(/ID es obligatorio/);
    expect(() =>
      db.dbProducts.create({ ...REMOTE_PRODUCT, id: "1" })
    ).toThrow(/ya existe un producto/);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("driver local — regresión de comportamiento", () => {
  it("el driver por defecto sigue usando localStorage y sus guardas de ventana", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_BACKEND", "");
    vi.resetModules();
    const fetchMock = stubFetch();
    const db = await import("@/lib/db");
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });

    expect(db.getDataBackend()).toBe("localStorage");
    db.initializeDatabase();
    expect(store.has("aventus-db-products")).toBe(true);
    expect(db.dbProducts.getAll()).toHaveLength(seedProducts.length);
    // Sin bloqueos de escritura en el backend por defecto:
    expect(() =>
      db.dbProducts.update("1", { name: "Renombrado" })
    ).not.toThrow();
    expect(db.dbProducts.getById("1")?.name).toBe("Renombrado");
    // Corte único: con localStorage NADA se envía a /api/data/*.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
