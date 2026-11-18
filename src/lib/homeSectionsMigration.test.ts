import { describe, expect, it } from "vitest";
import type { HomepageSection } from "@/types/cms";
import {
  HOME_SECTION_TYPES,
  isHomeSectionType,
  planHomeSectionsMigration,
  toHomeSectionRow,
} from "@/lib/homeSectionsMigration";

const defaults: HomepageSection[] = [
  { id: "1", type: "hero", title: "Hero", isActive: true, order: 1 },
  { id: "2", type: "categories", title: "Categorías", isActive: true, order: 2 },
  { id: "3", type: "featured", title: "Destacados", isActive: true, order: 3 },
  { id: "4", type: "offers", title: "Ofertas", isActive: true, order: 4 },
  { id: "5", type: "newArrivals", title: "Nuevos", isActive: true, order: 5 },
  { id: "6", type: "banner", title: "Banner", isActive: true, order: 6 },
  { id: "7", type: "brands", title: "Marcas", isActive: false, order: 7 },
  { id: "8", type: "about", title: "Sobre", isActive: true, order: 8 },
  { id: "9", type: "instagram", title: "IG", isActive: true, order: 9 },
  { id: "10", type: "contact", title: "Contacto", isActive: true, order: 10 },
];

describe("homeSectionsMigration", () => {
  it("los 10 tipos canónicos son válidos", () => {
    expect(HOME_SECTION_TYPES).toHaveLength(10);
    for (const t of HOME_SECTION_TYPES) {
      expect(isHomeSectionType(t)).toBe(true);
    }
    expect(isHomeSectionType("foo")).toBe(false);
  });

  it("las secciones por defecto son todas válidas", () => {
    const plan = planHomeSectionsMigration(defaults);
    expect(plan.total).toBe(10);
    expect(plan.valid).toBe(10);
    expect(plan.invalid).toBe(0);
  });

  it("id duplicado → inválida", () => {
    const plan = planHomeSectionsMigration([
      { id: "1", type: "hero", title: "A", isActive: true, order: 1 },
      { id: "1", type: "hero", title: "B", isActive: true, order: 2 },
    ]);
    expect(plan.invalid).toBe(1);
    expect(plan.results[1].blockers).toContain("id_duplicate");
  });

  it("tipo desconocido → inválida", () => {
    const plan = planHomeSectionsMigration([
      { id: "1", type: "foo" as any, title: "A", isActive: true, order: 1 },
    ]);
    expect(plan.results[0].blockers).toContain("type_unknown");
  });

  it("order no entero → inválida", () => {
    const plan = planHomeSectionsMigration([
      { id: "1", type: "hero", title: "A", isActive: true, order: 1.5 },
    ]);
    expect(plan.results[0].blockers).toContain("order_invalid");
  });

  it("content no-objeto → inválida", () => {
    const plan = planHomeSectionsMigration([
      { id: "1", type: "hero", title: "A", isActive: true, order: 1, content: "x" as any },
    ]);
    expect(plan.results[0].blockers).toContain("content_invalid");
  });

  it("toHomeSectionRow produce snake_case propuesto", () => {
    const row = toHomeSectionRow(defaults[0]);
    expect(row).toEqual({
      id: "1",
      type: "hero",
      title: "Hero",
      is_active: true,
      order: 1,
      content: null,
    });
  });

  it("schemaStatus missing y writable false (global)", () => {
    const plan = planHomeSectionsMigration(defaults);
    expect(plan.schemaStatus).toBe("missing");
    expect(plan.writable).toBe(false);
  });
});
