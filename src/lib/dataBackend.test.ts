/**
 * Tests del feature flag NEXT_PUBLIC_DATA_BACKEND (Fase C-1)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveDataBackend } from "@/lib/dataBackend";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resolveDataBackend", () => {
  it("usa localStorage cuando la variable no existe", () => {
    expect(resolveDataBackend(undefined)).toBe("localStorage");
  });

  it("usa localStorage cuando la variable está vacía o con espacios", () => {
    expect(resolveDataBackend("")).toBe("localStorage");
    expect(resolveDataBackend("   ")).toBe("localStorage");
  });

  it("acepta localStorage exacto y con mayúsculas/mezcla", () => {
    expect(resolveDataBackend("localStorage")).toBe("localStorage");
    expect(resolveDataBackend("LocalStorage")).toBe("localStorage");
  });

  it("acepta supabase en cualquier combinación de mayúsculas", () => {
    expect(resolveDataBackend("supabase")).toBe("supabase");
    expect(resolveDataBackend("SUPABASE")).toBe("supabase");
    expect(resolveDataBackend("  Supabase  ")).toBe("supabase");
  });

  it("degrada a localStorage ante un valor desconocido, sin lanzar", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(resolveDataBackend("postgres")).toBe("localStorage");
    expect(resolveDataBackend("true")).toBe("localStorage");
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0]?.[0]).toContain("no es válido");
  });

  it("no advierte cuando el valor es válido o ausente", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resolveDataBackend(undefined);
    resolveDataBackend("localStorage");
    resolveDataBackend("supabase");
    expect(warn).not.toHaveBeenCalled();
  });
});
