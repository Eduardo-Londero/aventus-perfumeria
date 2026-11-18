/**
 * Pruebas de paridad y del plan — script de importación (Fase D)
 * ==============================================================
 * `scripts/import-to-supabase.mjs` corre con Node puro (sin TS), así que su
 * lógica de mapeo/validación es una réplica de `catalogWriteService.ts`.
 * Estas pruebas son el CONTRATO de esa réplica:
 *
 *   1. paridad exacta de mappers (mismo JSON final que el servidor de C-2),
 *   2. validación del dump (estructura + integridad de referencias),
 *   3. plan de escritura (orden FK, omisiones documentadas).
 *
 * Si cambia `catalogWriteService`, la paridad lo delata acá. Los tipos del
 * script viven en scripts/import-to-supabase.d.mts (el runtime es el .mjs).
 */

import { describe, expect, it } from "vitest";

import {
  brandToRow,
  categoryToRow,
  genderToRow,
  productToRow,
} from "@/lib/server/catalogWriteService";
import {
  DUMP_FORMAT,
  DUMP_VERSION,
  buildDump,
  emptyCollections,
  type Dump,
  type DumpCollections,
} from "@/lib/exportData";
import {
  DUMP_FORMAT as SCRIPT_FORMAT,
  DUMP_VERSION as SCRIPT_VERSION,
  SKIPPED,
  buildImportPlan,
  mapBrandToRow,
  mapCategoryToRow,
  mapGenderToRow,
  mapProductToRow,
  validateDump,
  type ScriptPlan,
  type ScriptStep,
} from "../../scripts/import-to-supabase.mjs";

import type { Category, Product } from "@/types";

const product: Product = {
  id: "1",
  slug: "dior-sauvage-edt-100",
  brand: "dior",
  name: "Sauvage",
  description: "Frescura desértica.",
  longDescription: "Composición poderosa y fresca.",
  price: 145000,
  previousPrice: 165000,
  discount: 12,
  images: ["https://example.test/a.jpg", "https://example.test/b.jpg"],
  categories: ["hombre", "ofertas"],
  gender: "hombre",
  size: "100 ml",
  concentration: "Eau de Toilette",
  olfactoryFamily: "Amaderado Aromático",
  notes: { top: ["Bergamota"], heart: ["Lavanda"], base: ["Cedro"] },
  stock: 8,
  featured: true,
  isActive: true,
  isOnSale: true,
  isNew: false,
  createdAt: "2024-01-15",
  soldCount: 45,
};

const hombre: Category = {
  id: "hombre",
  slug: "hombre",
  name: "Hombre",
  description: "",
  image: "https://example.test/cat.jpg",
  isActive: true,
  order: 1,
};

const ofertas: Category = {
  id: "ofertas",
  slug: "ofertas",
  name: "Ofertas",
  description: "",
  image: "",
  isActive: true,
  order: 2,
};

const dior = {
  id: "dior",
  slug: "dior",
  name: "Dior",
  image: "https://example.test/brand.jpg",
  isActive: true,
  order: 1,
};

const hombreGender = { id: "hombre", name: "Hombre", isActive: true };

function stepOf(plan: ScriptPlan, table: string): ScriptStep {
  const step = plan.steps.find((s) => s.table === table);
  if (!step) throw new Error(`Falta el paso "${table}" en el plan.`);
  return step;
}

describe("constantes espejo script ↔ exportData", () => {
  it("usa el mismo formato y versión", () => {
    expect(SCRIPT_FORMAT).toBe(DUMP_FORMAT);
    expect(SCRIPT_VERSION).toBe(DUMP_VERSION);
  });
});

describe("paridad de mappers con catalogWriteService (C-2)", () => {
  it("géneros: mismo JSON final", () => {
    expect(mapGenderToRow(hombreGender)).toEqual(genderToRow(hombreGender));
  });

  it("categorías: mismo JSON final (incluye '' → null)", () => {
    expect(mapCategoryToRow(hombre)).toEqual(categoryToRow(hombre));
  });

  it("marcas: mismo JSON final (description undefined → null)", () => {
    expect(mapBrandToRow(dior)).toEqual(brandToRow(dior));
  });

  it("productos: mismo JSON final (centavos, notas y nulls)", () => {
    expect(mapProductToRow(product)).toEqual(productToRow(product));
    // Regla clave de conversión: pesos enteros → centavos.
    expect(mapProductToRow(product).price_cents).toBe(14500000);
    expect(mapProductToRow(product).previous_price_cents).toBe(16500000);
  });

  it("productos mínimos: mismos defaults que el servidor", () => {
    const minimal = {
      id: "9",
      slug: "minimal",
      name: "Minimal",
      brand: "dior",
      gender: "hombre",
      images: ["https://example.test/x.jpg"],
      price: 0,
      createdAt: "2026-10-18",
    };
    expect(mapProductToRow(minimal)).toEqual(productToRow(minimal));
  });

  it("rechaza productos inválidos con el mismo criterio", () => {
    const broken = { ...product, price: -5 };
    expect(() => mapProductToRow(broken)).toThrow();
    expect(() => productToRow(broken)).toThrow();
  });
});

describe("validateDump", () => {
  function validDump(): Dump {
    return buildDump({
      products: [product],
      categories: [hombre, ofertas],
      brands: [dior],
      genders: [hombreGender],
    });
  }

  it("acepta un dump bien formado", () => {
    const result = validateDump(validDump());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts?.products).toBe(1);
  });

  it("rechaza formatos y versiones desconocidos", () => {
    expect(validateDump({ ...validDump(), format: "otro" }).ok).toBe(false);
    expect(validateDump({ ...validDump(), version: 99 }).ok).toBe(false);
    expect(validateDump(null).ok).toBe(false);
    expect(validateDump([]).ok).toBe(false);
  });

  it("rechaza colecciones que no son listas", () => {
    const dump = validDump();
    const malformed = {
      ...dump,
      collections: { ...dump.collections, products: {} },
    };
    const result = validateDump(malformed);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("collections.products");
  });

  it("acumula referencias rotas de marca, género y categoría", () => {
    const dump = validDump();
    dump.collections.products[0] = {
      ...product,
      brand: "inexistente",
      gender: "no existe",
      categories: ["hombre", "fantasma"],
    };
    const result = validateDump(dump);
    expect(result.ok).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.join(" ")).toContain('"inexistente"');
    expect(result.errors.join(" ")).toContain('"fantasma"');
  });

  it("detecta ids duplicados", () => {
    const dump = validDump();
    dump.collections.genders.push({ id: "hombre", name: "Duplicado", isActive: true });
    const result = validateDump(dump);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicado");
  });

  it("acumula errores entre registros (no falla al primero)", () => {
    const dump = validDump();
    dump.collections.products.push(
      { ...product, id: "x1", slug: "", price: -1 },
      { ...product, id: "x2", name: "" }
    );
    const result = validateDump(dump);
    expect(result.ok).toBe(false);
    // Un error por registro defectuoso, acumulados: ni el primero ni el último solos.
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
    expect(result.errors.join(" ")).toContain('"x1"');
    expect(result.errors.join(" ")).toContain('"x2"');
  });

  it("avisa (sin bloquear) que pedidos/home/carrito no se importan", () => {
    const dump = validDump();
    const withOrders = {
      ...dump,
      collections: { ...dump.collections, orders: [{ id: "AV-1" }] },
    };
    const result = validateDump(withOrders);
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain("orders");
  });

  it("acepta colecciones opcionales ausentes", () => {
    const dump = validDump();
    const collections: Partial<DumpCollections> = { ...dump.collections };
    delete collections.orders;
    delete collections.homeSections;
    delete collections.cart;
    const result = validateDump({ ...dump, collections });
    expect(result.ok).toBe(true);
    expect(result.counts?.orders).toBe(0);
    expect(result.counts?.homeSections).toBe(0);
    expect(result.counts?.cart).toBe(0);
  });
});

describe("buildImportPlan", () => {
  function fullDump(): Dump {
    return buildDump({
      products: [product],
      categories: [hombre, ofertas],
      brands: [dior],
      genders: [hombreGender],
    });
  }

  it("ordena las tablas por dependencias de FK", () => {
    const plan = buildImportPlan(fullDump());
    expect(plan.steps.map((s) => s.table)).toEqual([
      "genders",
      "categories",
      "brands",
      "products",
      "product_categories",
    ]);
  });

  it("genera los vínculos producto↔categoría del dump", () => {
    const plan = buildImportPlan(fullDump());
    const links = stepOf(plan, "product_categories");
    expect(links.rows).toEqual([
      { product_id: "1", category_id: "hombre" },
      { product_id: "1", category_id: "ofertas" },
    ]);
    // Reemplazo acotado a los productos del dump.
    expect(links.replaceFor).toEqual(["1"]);
  });

  it("declara las omisiones con su motivo", () => {
    const plan = buildImportPlan(buildDump(emptyCollections()));
    expect(plan.skipped.map((s) => s.entity)).toEqual(SKIPPED.map((s) => s.entity));
    expect(plan.skipped.map((s) => s.entity)).toContain("orders");
    expect(plan.skipped.map((s) => s.entity)).toContain("homeSections");
    expect(plan.skipped.map((s) => s.entity)).toContain("cart");
    for (const { reason } of plan.skipped) {
      expect(reason.length).toBeGreaterThan(0);
    }
  });

  it("es re-ejecutable: upsert por id, nunca insert ciego", () => {
    // El plan no distingue altas de modificaciones (upsert onConflict id);
    // esto documenta el contrato que el script ejecuta.
    const plan = buildImportPlan(fullDump());
    const products = stepOf(plan, "products");
    expect(products.rows).toHaveLength(1);
    expect(products.rows[0].id).toBe("1");
    expect(products.rows[0].price_cents).toBe(14500000);
  });
});
