/**
 * Tests de la cola de escrituras remotas (Fase C-2)
 * =================================================
 * src/lib/dataSync.ts es el tramo "escritura" del write-through optimista:
 * encola en serie, traduce errores del servidor a mensajes y ejecuta el
 * rollback + notificación cuando algo sale mal.
 *
 * Patrón: vi.resetModules() + stub del flag (igual que db.supabase.test.ts)
 * y stub global de `fetch`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

async function importDataSync(backend: "supabase" | "localStorage" = "supabase") {
  vi.stubEnv("NEXT_PUBLIC_DATA_BACKEND", backend);
  vi.resetModules();
  const dataSync = await import("@/lib/dataSync");
  return dataSync;
}

function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function rejected(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("dataSync — cola hacia /api/data/*", () => {
  it("create hace POST con la fila y no registra error", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const dataSync = await importDataSync();
    const rollback = vi.fn();

    dataSync.enqueueWrite(
      { entity: "brands", kind: "create", id: "nike", payload: { id: "nike" } },
      rollback
    );
    await dataSync.whenWritesSettled();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/data/brands");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(JSON.parse(String(init.body))).toEqual({ id: "nike" });
    expect(rollback).not.toHaveBeenCalled();
    expect(dataSync.getLastWriteError()).toBeNull();
  });

  it("update/delete apuntan al id codificado y delete va sin cuerpo", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const dataSync = await importDataSync();

    dataSync.enqueueWrite(
      { entity: "products", kind: "update", id: "12 3", payload: { id: "12 3" } },
      vi.fn()
    );
    dataSync.enqueueWrite(
      { entity: "products", kind: "delete", id: "12 3" },
      vi.fn()
    );
    await dataSync.whenWritesSettled();

    const [update, remove] = fetchMock.mock.calls as unknown as Array<
      [string, RequestInit]
    >;
    expect(update[0]).toBe("/api/data/products/12%203");
    expect(update[1].method).toBe("PATCH");
    expect(remove[1].method).toBe("DELETE");
    expect(remove[1].body).toBeUndefined();
  });

  it("ejecuta en serie: la segunda espera a que termine la primera", async () => {
    const trace: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        trace.push(`start ${init?.method}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        trace.push(`end ${init?.method}`);
        return ok();
      })
    );
    const dataSync = await importDataSync();

    dataSync.enqueueWrite(
      { entity: "genders", kind: "create", id: "a", payload: { id: "a" } },
      vi.fn()
    );
    dataSync.enqueueWrite(
      { entity: "genders", kind: "update", id: "a", payload: { id: "a" } },
      vi.fn()
    );
    await dataSync.whenWritesSettled();

    expect(trace).toEqual(["start POST", "end POST", "start PATCH", "end PATCH"]);
  });
});

describe("dataSync — rechazos", () => {
  it("un 4xx ejecuta el rollback, notifica y guarda el mensaje", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        rejected(409, { ok: false, code: "CONFLICT", message: "Slug duplicado" })
      )
    );
    const dataSync = await importDataSync();
    const rollback = vi.fn();
    const seen: string[] = [];
    const off = dataSync.subscribeWriteFailure((f) => seen.push(f.message));

    dataSync.enqueueWrite(
      { entity: "categories", kind: "create", id: "x", payload: { id: "x" } },
      rollback
    );
    await dataSync.whenWritesSettled();

    expect(rollback).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(["Slug duplicado"]);
    expect(dataSync.getLastWriteError()).toBe("Slug duplicado");
    off();
  });

  it("un error de red produce un mensaje accionable (no un stack)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      })
    );
    const dataSync = await importDataSync();
    const seen: string[] = [];
    dataSync.subscribeWriteFailure((f) => seen.push(f.message));

    dataSync.enqueueWrite(
      { entity: "products", kind: "delete", id: "1" },
      vi.fn()
    );
    await dataSync.whenWritesSettled();

    expect(seen[0]).toMatch(/No se pudo conectar con el servidor/);
    expect(dataSync.getLastWriteError()).toMatch(/conexión/);
  });

  it("si el cuerpo no es JSON, informa el estado HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>proxy</html>", { status: 502 }))
    );
    const dataSync = await importDataSync();
    const seen: string[] = [];
    dataSync.subscribeWriteFailure((f) => seen.push(f.message));

    dataSync.enqueueWrite({ entity: "brands", kind: "delete", id: "b" }, vi.fn());
    await dataSync.whenWritesSettled();

    expect(seen[0]).toMatch(/HTTP 502/);
    expect(seen[0]).not.toMatch(/<html>/);
  });

  it("el fallo de una operación no trunca la cola: la siguiente se envía", async () => {
    const fetchMock = vi.fn(async () =>
      rejected(500, { ok: false, message: "boom" })
    );
    vi.stubGlobal("fetch", fetchMock);
    const dataSync = await importDataSync();

    dataSync.enqueueWrite({ entity: "brands", kind: "delete", id: "a" }, vi.fn());
    dataSync.enqueueWrite(
      { entity: "brands", kind: "create", id: "b", payload: { id: "b" } },
      vi.fn()
    );
    await dataSync.whenWritesSettled();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("los suscriptores se dan de baja y un listener que lanza no rompe a los demás", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => rejected(400, { ok: false, message: "mal" }))
    );
    const dataSync = await importDataSync();

    const boom = vi.fn(() => {
      throw new Error("listener roto");
    });
    const removed = vi.fn();
    const okListener = vi.fn();

    dataSync.subscribeWriteFailure(boom);
    const off = dataSync.subscribeWriteFailure(removed);
    dataSync.subscribeWriteFailure(okListener);
    off();

    dataSync.enqueueWrite({ entity: "genders", kind: "delete", id: "g" }, vi.fn());
    await dataSync.whenWritesSettled();

    expect(removed).not.toHaveBeenCalled();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(okListener).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("dataSync — corte único con localStorage", () => {
  it("no encola ni llama a fetch cuando el backend es el por defecto", async () => {
    const fetchMock = vi.fn(async () => ok());
    vi.stubGlobal("fetch", fetchMock);
    const dataSync = await importDataSync("localStorage");
    const rollback = vi.fn();

    dataSync.enqueueWrite(
      { entity: "products", kind: "create", id: "x", payload: { id: "x" } },
      rollback
    );
    await dataSync.whenWritesSettled();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(rollback).not.toHaveBeenCalled();
    expect(dataSync.getLastWriteError()).toBeNull();
  });
});
