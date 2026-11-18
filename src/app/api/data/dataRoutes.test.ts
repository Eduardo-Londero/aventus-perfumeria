/**
 * Tests de las rutas /api/data/* (Fase C-2)
 * ==========================================
 * Verifican el orden de guardas y el shape de respuesta, sin tocar Supabase:
 * el servicio de escritura está mockeado y la sesión se firma en el test con
 * el mismo código que usa producción (src/lib/session.ts).
 *
 * Cobertura: 409 (backend no activo) · 401 (sin sesión) · 404 (entidad/id) ·
 * 400 (cuerpo/validación) · 409 (conflicto) · 201/200 (éxito) · 500 (caos).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

const serviceMock = vi.hoisted(() => ({
  createEntity: vi.fn(),
  updateEntity: vi.fn(),
  deleteEntity: vi.fn(),
}));
vi.mock("@/lib/server/catalogWriteService", () => serviceMock);

type RouteModules = typeof import("@/app/api/data/[entity]/route");
type ItemRouteModules = typeof import("@/app/api/data/[entity]/[id]/route");

/**
 * Importa las rutas frescas con el flag elegido (DATA_BACKEND se lee al
 * importar, por eso resetModules + stubEnv en ese orden).
 */
async function importRoutes(
  backend: "supabase" | "localStorage" = "supabase"
): Promise<{ routes: RouteModules; item: ItemRouteModules }> {
  vi.stubEnv("NEXT_PUBLIC_DATA_BACKEND", backend);
  vi.resetModules();
  const routes = await import("@/app/api/data/[entity]/route");
  const item = await import("@/app/api/data/[entity]/[id]/route");
  return { routes, item };
}

/** Firma una sesión de admin válida con el secreto de prueba. */
async function adminCookie(): Promise<string> {
  vi.stubEnv(
    "ADMIN_SESSION_SECRET",
    "secreto-de-prueba-suficientemente-largo"
  );
  const session = await import("@/lib/session");
  const token = await session.signAdminSession({
    sub: "admin@test.local",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  if (!token) throw new Error("no se pudo firmar la sesión de prueba");
  return `${session.ADMIN_SESSION_COOKIE}=${token}`;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  rawBody?: string;
  cookie?: string;
}

function makeRequest(options: RequestOptions = {}): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (options.cookie) headers.cookie = options.cookie;

  const hasBody =
    options.rawBody !== undefined || options.body !== undefined;
  return new NextRequest("http://localhost/api/data/products", {
    method: options.method ?? "POST",
    headers,
    ...(hasBody
      ? { body: options.rawBody ?? JSON.stringify(options.body) }
      : {}),
  });
}

const entityCtx = (entity: string) => ({ params: Promise.resolve({ entity }) });
const itemCtx = (entity: string, id: string) => ({
  params: Promise.resolve({ entity, id }),
});

afterEach(() => {
  serviceMock.createEntity.mockReset();
  serviceMock.updateEntity.mockReset();
  serviceMock.deleteEntity.mockReset();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("POST /api/data/[entity]", () => {
  it("409 si el build corre con el backend por defecto (corte único)", async () => {
    const { routes } = await importRoutes("localStorage");
    const response = await routes.POST(makeRequest({ body: { id: "x" } }), entityCtx("brands"));

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.code).toBe("BACKEND_NOT_ACTIVE");
    expect(serviceMock.createEntity).not.toHaveBeenCalled();
  });

  it("401 sin cookie de administrador (el service_role no se usa sin sesión)", async () => {
    const { routes } = await importRoutes("supabase");
    const response = await routes.POST(
      makeRequest({ body: { id: "x" } }),
      entityCtx("brands")
    );

    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("UNAUTHORIZED");
    expect(serviceMock.createEntity).not.toHaveBeenCalled();
  });

  it("401 con una cookie firmada con otro secreto o vencida", async () => {
    const { routes } = await importRoutes("supabase");
    const response = await routes.POST(
      makeRequest({ body: { id: "x" }, cookie: "aventus_admin_session=aaa.bbb" }),
      entityCtx("brands")
    );

    expect(response.status).toBe(401);
    expect(serviceMock.createEntity).not.toHaveBeenCalled();
  });

  it("404 ante una entidad fuera de la lista blanca", async () => {
    const { routes } = await importRoutes("supabase");
    const cookie = await adminCookie();
    const response = await routes.POST(
      makeRequest({ body: { id: "x" }, cookie }),
      entityCtx("orders")
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("INVALID_ENTITY");
    expect(serviceMock.createEntity).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo no es JSON", async () => {
    const { routes } = await importRoutes("supabase");
    const cookie = await adminCookie();
    const response = await routes.POST(
      makeRequest({ rawBody: "esto no es json", cookie }),
      entityCtx("brands")
    );

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_BODY");
    expect(serviceMock.createEntity).not.toHaveBeenCalled();
  });

  it("201 con { ok, action, entity, id } cuando el servicio persiste", async () => {
    const { routes } = await importRoutes("supabase");
    const cookie = await adminCookie();
    const payload = { id: "nike", name: "Nike" };
    serviceMock.createEntity.mockResolvedValue({ id: "nike" });

    const response = await routes.POST(
      makeRequest({ body: payload, cookie }),
      entityCtx("brands")
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ok: true,
      action: "create",
      entity: "brands",
      id: "nike",
    });
    expect(serviceMock.createEntity).toHaveBeenCalledWith("brands", payload);
  });

  it("400 cuando el servicio valida mal el payload", async () => {
    const { routes } = await importRoutes("supabase");
    const { ValidationError } = await import("@/lib/server/apiError");
    const cookie = await adminCookie();
    serviceMock.createEntity.mockRejectedValue(
      new ValidationError('El campo "name" es obligatorio y debe ser texto.')
    );

    const response = await routes.POST(
      makeRequest({ body: {}, cookie }),
      entityCtx("brands")
    );

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe("VALIDATION");
    expect(data.message).toMatch(/"name"/);
  });

  it("500 ante un error inesperado, sin filtrar detalles", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { routes } = await importRoutes("supabase");
    const cookie = await adminCookie();
    serviceMock.createEntity.mockRejectedValue(new Error("detalle interno"));

    const response = await routes.POST(
      makeRequest({ body: { id: "x" }, cookie }),
      entityCtx("brands")
    );

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.code).toBe("INTERNAL");
    expect(data.message).not.toMatch(/detalle interno/);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("PATCH y DELETE /api/data/[entity]/[id]", () => {
  it("PATCH 200 delegando entidad, id y cuerpo", async () => {
    const { item } = await importRoutes("supabase");
    const cookie = await adminCookie();
    const payload = { id: "nike", name: "Nike Air" };
    serviceMock.updateEntity.mockResolvedValue({ id: "nike" });

    const response = await item.PATCH(
      makeRequest({ method: "PATCH", body: payload, cookie }),
      itemCtx("brands", "nike")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      action: "update",
      entity: "brands",
      id: "nike",
    });
    expect(serviceMock.updateEntity).toHaveBeenCalledWith(
      "brands",
      "nike",
      payload
    );
  });

  it("PATCH 400 si el id de la URL está vacío (el servicio no se invoca)", async () => {
    const { item } = await importRoutes("supabase");
    const cookie = await adminCookie();

    const response = await item.PATCH(
      makeRequest({ method: "PATCH", body: { id: "x" }, cookie }),
      itemCtx("brands", "   ")
    );

    expect(response.status).toBe(400);
    expect(serviceMock.updateEntity).not.toHaveBeenCalled();
  });

  it("PATCH 404 cuando el id no existe en la tabla", async () => {
    const { item } = await importRoutes("supabase");
    const { NotFoundError } = await import("@/lib/server/apiError");
    const cookie = await adminCookie();
    serviceMock.updateEntity.mockRejectedValue(
      new NotFoundError('No existe una marca con ID "fantasma".')
    );

    const response = await item.PATCH(
      makeRequest({ method: "PATCH", body: { id: "fantasma" }, cookie }),
      itemCtx("brands", "fantasma")
    );

    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("NOT_FOUND");
  });

  it("DELETE 200 sin cuerpo de petición", async () => {
    const { item } = await importRoutes("supabase");
    const cookie = await adminCookie();
    serviceMock.deleteEntity.mockResolvedValue({ id: "nike" });

    const response = await item.DELETE(
      makeRequest({ method: "DELETE", cookie }),
      itemCtx("brands", "nike")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      action: "delete",
      entity: "brands",
      id: "nike",
    });
    expect(serviceMock.deleteEntity).toHaveBeenCalledWith("brands", "nike");
  });

  it("DELETE 409 si el registro todavía está en uso (conflicto de integridad)", async () => {
    const { item } = await importRoutes("supabase");
    const { ConflictError } = await import("@/lib/server/apiError");
    const cookie = await adminCookie();
    serviceMock.deleteEntity.mockRejectedValue(
      new ConflictError("No se puede eliminar: registros dependientes.")
    );

    const response = await item.DELETE(
      makeRequest({ method: "DELETE", cookie }),
      itemCtx("brands", "nike")
    );

    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.code).toBe("CONFLICT");
    expect(data.message).toMatch(/dependientes/);
  });

  it("DELETE 401 si no hay sesión, sin consultar al servicio", async () => {
    const { item } = await importRoutes("supabase");
    const response = await item.DELETE(
      makeRequest({ method: "DELETE" }),
      itemCtx("brands", "nike")
    );

    expect(response.status).toBe(401);
    expect(serviceMock.deleteEntity).not.toHaveBeenCalled();
  });
});
