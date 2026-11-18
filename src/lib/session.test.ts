import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_TTL_SECONDS,
  getAdminSessionSecret,
  secureEquals,
  signAdminSession,
  verifyAdminSession,
} from "@/lib/session";

const TEST_SECRET = "secreto-de-prueba-suficientemente-largo";

afterEach(() => {
  vi.unstubAllEnvs();
});

function futureExp(offsetSeconds = 60): number {
  return Math.floor(Date.now() / 1000) + offsetSeconds;
}

describe("getAdminSessionSecret", () => {
  it("devuelve null cuando no hay secreto configurado", () => {
    vi.stubEnv("ADMIN_SESSION_SECRET", "");
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(getAdminSessionSecret()).toBeNull();
  });

  it("devuelve null con secretos triviales (< 8 caracteres)", () => {
    vi.stubEnv("ADMIN_PASSWORD", "corto");
    expect(getAdminSessionSecret()).toBeNull();
  });

  it("acepta ADMIN_PASSWORD como secreto de respaldo", () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    expect(getAdminSessionSecret()).toBe(TEST_SECRET);
  });
});

describe("signAdminSession / verifyAdminSession", () => {
  it("firma y verifica un token válido", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    const token = await signAdminSession({ sub: "admin@tienda.com", exp: futureExp() });
    expect(token).toBeTruthy();

    const session = await verifyAdminSession(token);
    expect(session).not.toBeNull();
    expect(session?.sub).toBe("admin@tienda.com");
    expect(session?.role).toBe("admin");
  });

  it("NO firma sin secreto (fail closed)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await signAdminSession({ sub: "a", exp: futureExp() })).toBeNull();
  });

  it("rechaza tokens firmados con otro secreto", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    const token = await signAdminSession({ sub: "admin", exp: futureExp() });

    vi.stubEnv("ADMIN_PASSWORD", "otro-secreto-totalmente-distinto");
    expect(await verifyAdminSession(token)).toBeNull();
  });

  it("rechaza tokens manipulados (payload alterado)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    const token = (await signAdminSession({ sub: "cliente", exp: futureExp() }))!;
    const [, signature] = token.split(".");

    // Intento de extender la sesión un año reescribiendo el payload.
    const decoded = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8")
    ) as { exp: number };
    decoded.exp = futureExp(60 * 60 * 24 * 365);
    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    expect(await verifyAdminSession(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rechaza tokens vencidos", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    const token = await signAdminSession({ sub: "admin", exp: futureExp(-1) });
    expect(await verifyAdminSession(token)).toBeNull();
  });

  it("rechaza tokens malformados", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    expect(await verifyAdminSession("")).toBeNull();
    expect(await verifyAdminSession(null)).toBeNull();
    expect(await verifyAdminSession(undefined)).toBeNull();
    expect(await verifyAdminSession("sin-puntos")).toBeNull();
    expect(await verifyAdminSession("a.b.c")).toBeNull();
    expect(await verifyAdminSession("payload-invalido.firma")).toBeNull();
  });

  it("rechaza tokens con rol alterado a 'customer'", async () => {
    vi.stubEnv("ADMIN_PASSWORD", TEST_SECRET);
    const token = (await signAdminSession({ sub: "admin", exp: futureExp() }))!;
    const signature = token.split(".")[1];

    const decoded = JSON.parse(
      Buffer.from(token.split(".")[0], "base64url").toString("utf8")
    ) as { role: string };
    decoded.role = "customer";
    const altered = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    expect(await verifyAdminSession(`${altered}.${signature}`)).toBeNull();
  });

  it("el TTL configurado es de 8 horas", () => {
    expect(ADMIN_SESSION_TTL_SECONDS).toBe(60 * 60 * 8);
  });
});

describe("secureEquals", () => {
  it("compara cadenas idénticas", async () => {
    expect(await secureEquals("abc", "abc")).toBe(true);
    expect(await secureEquals("", "")).toBe(true);
  });

  it("detecta diferencias", async () => {
    expect(await secureEquals("abc", "abd")).toBe(false);
    expect(await secureEquals("abc", "abc ")).toBe(false);
    expect(await secureEquals("", "x")).toBe(false);
  });
});
