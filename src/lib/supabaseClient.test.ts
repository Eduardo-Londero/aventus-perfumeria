/**
 * Tests de la configuración pública del cliente Supabase (Fase C-1)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getSupabase,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
  resetSupabaseForTests,
} from "@/lib/supabaseClient";

beforeEach(() => {
  resetSupabaseForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("getSupabasePublicConfig", () => {
  it("lee las variables con prefijo NEXT_PUBLIC_", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", " https://abc.supabase.co ");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", " clave-anon ");
    expect(getSupabasePublicConfig()).toEqual({
      url: "https://abc.supabase.co",
      anonKey: "clave-anon",
    });
  });

  it("acepta los nombres sin prefijo como respaldo (lado servidor)", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_URL", "https://legacy.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "legacy-key");
    expect(getSupabasePublicConfig()).toEqual({
      url: "https://legacy.supabase.co",
      anonKey: "legacy-key",
    });
  });

  it("falla con mensaje accionable si faltan las claves", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(() => getSupabasePublicConfig()).toThrow(/NEXT_PUBLIC_DATA_BACKEND/);
    expect(hasSupabasePublicConfig()).toBe(false);
  });

  it("hasSupabasePublicConfig es true con claves presentes", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave");
    expect(hasSupabasePublicConfig()).toBe(true);
  });
});

describe("getSupabase (singleton)", () => {
  it("devuelve siempre la misma instancia y expone el cliente", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "clave");
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
    expect(typeof a.from).toBe("function");
  });

  it("si faltan claves, lanza (fail fast) sin crear el cliente", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(() => getSupabase()).toThrow(/faltan/);
  });
});
