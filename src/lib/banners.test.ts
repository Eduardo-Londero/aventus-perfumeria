/**
 * Tests de la lógica de vigencia de los banners (src/lib/banners.ts)
 * ==================================================================
 * Puro, sin red: la fecha de "hoy" se pasa explícita para que el resultado
 * no dependa del día en que corra el suite.
 */
import { describe, it, expect } from "vitest";
import {
  bannerStatus,
  isBannerActiveOn,
  isBannerType,
  selectVisibleBanners,
} from "@/lib/banners";
import type { Banner } from "@/types/cms";

const banner = (overrides: Partial<Banner> = {}): Banner => ({
  id: "1",
  title: "Envío gratis",
  subtitle: "",
  image: "",
  buttonText: "",
  buttonLink: "",
  startDate: "",
  endDate: "",
  isActive: true,
  order: 1,
  type: "promotion",
  ...overrides,
});

describe("isBannerType", () => {
  it("acepta solo los tipos del modelo", () => {
    expect(isBannerType("promotion")).toBe(true);
    expect(isBannerType("season")).toBe(true);
    expect(isBannerType("banner")).toBe(false);
    expect(isBannerType(7)).toBe(false);
  });
});

describe("isBannerActiveOn", () => {
  const hoy = "2026-11-18";

  it("activo y sin fechas ⇒ siempre vigente", () => {
    expect(isBannerActiveOn(banner(), hoy)).toBe(true);
  });

  it("inactivo ⇒ nunca", () => {
    expect(isBannerActiveOn(banner({ isActive: false }), hoy)).toBe(false);
  });

  it("respeta el rango de fechas inclusive", () => {
    const b = banner({ startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(isBannerActiveOn(b, "2026-10-31")).toBe(false);
    expect(isBannerActiveOn(b, "2026-11-01")).toBe(true);
    expect(isBannerActiveOn(b, "2026-11-18")).toBe(true);
    expect(isBannerActiveOn(b, "2026-11-30")).toBe(true);
    expect(isBannerActiveOn(b, "2026-12-01")).toBe(false);
  });

  it("un solo límite también cuenta", () => {
    expect(
      isBannerActiveOn(banner({ startDate: "2026-11-01" }), "2026-10-15")
    ).toBe(false);
    expect(
      isBannerActiveOn(banner({ endDate: "2026-11-30" }), "2026-12-15")
    ).toBe(false);
  });
});

describe("bannerStatus", () => {
  const hoy = "2026-11-18";

  it("distingue inactivo, programado, vencido y vigente", () => {
    expect(bannerStatus(banner({ isActive: false }), hoy)).toBe("inactive");
    expect(
      bannerStatus(banner({ startDate: "2026-12-01" }), hoy)
    ).toBe("scheduled");
    expect(bannerStatus(banner({ endDate: "2026-11-01" }), hoy)).toBe(
      "expired"
    );
    expect(bannerStatus(banner(), hoy)).toBe("active");
  });
});

describe("selectVisibleBanners", () => {
  it("filtra por vigencia y ordena por `order`", () => {
    const banners = [
      banner({ id: "b", order: 2, endDate: "2026-11-01" }),
      banner({ id: "c", order: 3 }),
      banner({ id: "a", order: 1, isActive: false }),
      banner({ id: "d", order: 4 }),
    ];
    expect(selectVisibleBanners(banners, "2026-11-18").map((b) => b.id)).toEqual([
      "c",
      "d",
    ]);
  });
});
