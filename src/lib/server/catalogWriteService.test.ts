/**
 * Tests de validación y mapeo de la escritura del catálogo (Fase C-2)
 * ===================================================================
 * Cubren la mitad PURA de src/lib/server/catalogWriteService.ts: mappers
 * app↔fila con validación, la ida y vuelta completa (round-trip) y la
 * traducción de errores de Postgres. NO tocan red: el cliente supabase solo
 * se usa en las operaciones, que acá no se invocan.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import type { Brand, Category, Product } from "@/types";
import {
  bannerToRow,
  brandToRow,
  categoryToRow,
  createEntity,
  deleteEntity,
  genderToRow,
  productCategoryIds,
  productToRow,
  productUpdateRow,
  updateEntity,
} from "@/lib/server/catalogWriteService";
import { ValidationError, mapPostgrestError } from "@/lib/server/apiError";
import { productRowToProduct, bannerRowToBanner } from "@/lib/catalogMapper";
import {
  CATALOG_ENTITIES,
  COLLECTION_ENTITIES,
  isCatalogEntity,
  isCollectionEntity,
} from "@/lib/catalogEntities";

const product: Product = {
  id: "1",
  slug: "sauvage-edp",
  name: "Sauvage EDP",
  brand: "dior",
  description: "Fresco y amaderado",
  price: 145000,
  previousPrice: 180000,
  discount: 20,
  images: ["https://img/1.jpg"],
  categories: ["hombre"],
  gender: "hombre",
  size: "100 ml",
  concentration: "EDP",
  olfactoryFamily: "Amaderado",
  notes: { top: ["Bergamota"], heart: ["Lavanda"], base: ["Ambroxan"] },
  stock: 5,
  featured: true,
  isActive: true,
  isOnSale: true,
  isNew: false,
  createdAt: "2026-10-18T10:00:00.000Z",
  soldCount: 7,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("lista blanca de entidades (compartida cliente/servidor)", () => {
  it("acepta exactamente las colecciones hidratadas (catálogo + CMS)", () => {
    expect(CATALOG_ENTITIES).toEqual([
      "products",
      "categories",
      "brands",
      "genders",
      "home_sections",
      "banners",
    ]);
    for (const entity of CATALOG_ENTITIES) {
      expect(isCatalogEntity(entity)).toBe(true);
    }
    expect(isCatalogEntity("orders")).toBe(false);
    // El nombre canónico es "home_sections" (el de la tabla): el camelCase
    // que se usa en el modelo de la app NO debe ser aceptado por la API.
    expect(isCatalogEntity("homeSections")).toBe(false);
    expect(isCatalogEntity(42)).toBe(false);
  });

  it("la escritura por colección (PUT) solo admite home_sections y banners", () => {
    expect([...COLLECTION_ENTITIES]).toEqual(["home_sections", "banners"]);
    expect(isCollectionEntity("home_sections")).toBe(true);
    expect(isCollectionEntity("banners")).toBe(true);
    expect(isCollectionEntity("products")).toBe(false);
    expect(isCollectionEntity(undefined)).toBe(false);
  });
});

describe("bannerToRow (CMS de banners)", () => {
  const banner = {
    id: "1",
    title: "Envío gratis",
    subtitle: "En pedidos superiores a $50.000",
    image: "https://img/banner.jpg",
    buttonText: "Comprar",
    buttonLink: "/perfumes",
    startDate: "",
    endDate: "",
    isActive: true,
    order: 2,
    type: "promotion",
  };

  it("acepta un banner completo y lo mapea a la fila", () => {
    const row = bannerToRow(banner);
    expect(row).toEqual({
      id: "1",
      title: "Envío gratis",
      subtitle: "En pedidos superiores a $50.000",
      image: "https://img/banner.jpg",
      button_text: "Comprar",
      button_link: "/perfumes",
      start_date: null,
      end_date: null,
      is_active: true,
      order: 2,
      type: "promotion",
    });
    // Ida y vuelta: la fila vuelve al modelo sin cambios.
    expect(bannerRowToBanner(row)).toEqual(banner);
  });

  it("sin fechas el banner queda con vigencia abierta (NULL)", () => {
    expect(bannerToRow({ ...banner, startDate: "", endDate: "" })).toMatchObject({
      start_date: null,
      end_date: null,
    });
  });

  it("rechaza un tipo de banner fuera de la lista blanca", () => {
    expect(() => bannerToRow({ ...banner, type: "whatever" })).toThrow(
      /tipo de banner/
    );
  });

  it("rechaza fechas con formato distinto a AAAA-MM-DD", () => {
    expect(() => bannerToRow({ ...banner, startDate: "31/12/2026" })).toThrow(
      /AAAA-MM-DD/
    );
    expect(() => bannerToRow({ ...banner, endDate: "navidad" })).toThrow(
      /AAAA-MM-DD/
    );
  });

  it("rechaza una fecha final anterior a la inicial", () => {
    expect(() =>
      bannerToRow({ ...banner, startDate: "2026-12-31", endDate: "2026-01-01" })
    ).toThrow(/endDate/);
  });

  it("exige título y acepta el resto con defaults seguros", () => {
    expect(() => bannerToRow({ ...banner, title: "  " })).toThrow(/"title"/);
    const row = bannerToRow({ id: "9", title: "Solo título", type: "season" });
    expect(row).toMatchObject({
      subtitle: "",
      image: "",
      button_text: "",
      button_link: "",
      is_active: true,
      order: 0,
    });
  });
});

describe("validación de payloads", () => {
  it("rechaza cuerpos que no son objetos", () => {
    expect(() => genderToRow(null)).toThrow(/objeto JSON/);
    expect(() => genderToRow("marca")).toThrow(/objeto JSON/);
    expect(() => genderToRow([1, 2])).toThrow(/objeto JSON/);
  });

  it("exige campos obligatorios con mensaje nombrando el campo", () => {
    expect(() => genderToRow({ name: "Unisex" })).toThrow(/"id"/);
    expect(() => genderToRow({ id: "u" })).toThrow(/"name"/);
    expect(() => productToRow({ id: "1" })).toThrow(/"slug"/);
    expect(() => productToRow({ id: "1", slug: "x" })).toThrow(/"name"/);
    expect(() =>
      productToRow({ id: "1", slug: "x", name: "X" })
    ).toThrow(/"brand"/);
  });

  it("valida importes, enteros, descuentos y fechas", () => {
    expect(() => productToRow({ ...product, price: -1 })).toThrow(/"price"/);
    expect(() => productToRow({ ...product, price: "145000" })).toThrow(
      /"price"/
    );
    expect(() => productToRow({ ...product, stock: 2.5 })).toThrow(/"stock"/);
    expect(() => productToRow({ ...product, discount: 150 })).toThrow(
      /"discount"/
    );
    expect(() => productToRow({ ...product, createdAt: "mañana" })).toThrow(
      /"createdAt"/
    );
    expect(() => productToRow({ ...product, images: "https://a" })).toThrow(
      /"images"/
    );
    expect(() => productToRow({ ...product, images: [] })).not.toThrow();
  });

  it("las categorías deben venir como lista de textos", () => {
    expect(() => productCategoryIds({ categories: "hombre" })).toThrow(
      /"categories"/
    );
    expect(() => productCategoryIds({})).toThrow(/"categories"/);
    expect(() => productCategoryIds({ categories: ["hombre", " "] })).toThrow(
      /categories\[1\]/
    );
    expect(productCategoryIds({ categories: [] })).toEqual([]);
  });

  it("los booleanos opcionales caen en valores por defecto coherentes", () => {
    const row = productToRow({ ...product, featured: undefined, isNew: null });
    expect(row.featured).toBe(false);
    expect(row.is_new).toBe(false);
    expect(row.is_active).toBe(true);
    expect(() => productToRow({ ...product, isActive: "si" })).toThrow(
      /"isActive"/
    );
  });
});

describe("mapeo app → fila", () => {
  it("convierte importes a centavos y textos vacíos a NULL", () => {
    const row = productToRow(product);
    expect(row.price_cents).toBe(14_500_000);
    expect(row.previous_price_cents).toBe(18_000_000);
    expect(row.brand_id).toBe("dior");
    expect(row.gender_id).toBe("hombre");
    expect(row.notes_top).toEqual(["Bergamota"]);
    expect(row.created_at).toBe("2026-10-18T10:00:00.000Z");

    const empty = productToRow({
      ...product,
      description: "",
      longDescription: "",
      previousPrice: undefined,
      discount: undefined,
      size: "",
    });
    expect(empty.description).toBeNull();
    expect(empty.long_description).toBeNull();
    expect(empty.previous_price_cents).toBeNull();
    expect(empty.discount).toBeNull();
    expect(empty.size).toBeNull();
  });

  it("descarta Brand.logo/website y Category.parentId (sin columna en 0001)", () => {
    const brand = brandToRow({
      id: "dior",
      slug: "dior",
      name: "Dior",
      isActive: true,
      order: 1,
      logo: "https://logo",
      website: "https://dior.com",
      image: "https://img",
      description: null,
    });
    expect(brand).not.toHaveProperty("logo");
    expect(brand).not.toHaveProperty("website");
    expect(brand.image_url).toBe("https://img");

    const category = categoryToRow({
      id: "hombre",
      slug: "hombre",
      name: "Hombre",
      description: "",
      image: "",
      isActive: true,
      order: 2,
      parentId: "raiz",
    });
    expect(category).not.toHaveProperty("parent_id");
    expect(category.description).toBeNull();
    expect(category.image_url).toBeNull();
    expect(category.is_active).toBe(true);
  });

  it("productUpdateRow elimina created_at (la alta no se reescribe)", () => {
    const update = productUpdateRow(productToRow(product));
    expect(update).not.toHaveProperty("created_at");
    expect(update).toHaveProperty("price_cents", 14_500_000);
  });
});

describe("ida y vuelta completa (fila → app)", () => {
  it("productToRow + productRowToProduct devuelve el producto original", () => {
    const restored = productRowToProduct(productToRow(product), ["hombre"]);
    expect(restored).toEqual(product);
  });

  it("round-trip de marca y categoría conserva lo que sí tiene columna", () => {
    const brand: Brand = {
      id: "dior",
      slug: "dior",
      name: "Dior",
      description: "Casa francesa",
      image: "https://img/dior.jpg",
      isActive: true,
      order: 3,
    };
    expect(brandToRow(brand)).toMatchObject({
      id: "dior",
      slug: "dior",
      name: "Dior",
      description: "Casa francesa",
      image_url: "https://img/dior.jpg",
      order: 3,
      is_active: true,
    });

    const category: Category = {
      id: "hombre",
      slug: "hombre",
      name: "Hombre",
      description: "Fragancias para hombre",
      image: "https://img/cat.jpg",
      isActive: true,
      order: 1,
    };
    expect(categoryToRow(category)).toMatchObject({
      id: "hombre",
      description: "Fragancias para hombre",
      image_url: "https://img/cat.jpg",
      is_active: true,
    });
  });
});

describe("mapPostgrestError → error de la API", () => {
  it("FK (23503) según entidad y acción", () => {
    const brandDelete = mapPostgrestError(
      { code: "23503", message: "violates" },
      { entity: "brands", action: "delete" }
    );
    expect(brandDelete.status).toBe(409);
    expect(brandDelete.message).toMatch(/Desactivalos|cambialos de marca/);

    const productCreate = mapPostgrestError(
      { code: "23503", message: "violates" },
      { entity: "products", action: "create" }
    );
    expect(productCreate.status).toBe(409);
    expect(productCreate.message).toMatch(/marca o el género/);
  });

  it("unique (23505) → 409; check/not-null (23514/23502) → 400", () => {
    expect(
      mapPostgrestError({ code: "23505", message: "dup" }, {
        entity: "brands",
        action: "create",
      })
    ).toMatchObject({ status: 409, code: "CONFLICT" });
    expect(
      mapPostgrestError({ code: "23514", message: "check" }, {
        entity: "products",
        action: "create",
      })
    ).toMatchObject({ status: 400, code: "VALIDATION" });
    expect(
      mapPostgrestError({ code: "23502", message: "null" }, {
        entity: "products",
        action: "create",
      })
    ).toMatchObject({ status: 400 });
  });

  it("faltante de privilegios → 500 con pista; desconocido → 500 genérico", () => {
    expect(
      mapPostgrestError({ code: "42501", message: "permission denied" }, {
        entity: "products",
        action: "create",
      })
    ).toMatchObject({ status: 500, code: "INTERNAL" });

    const generic = mapPostgrestError(
      { message: "algo raro ".repeat(80) },
      { entity: "products", action: "update" }
    );
    expect(generic.status).toBe(500);
    expect(generic.message.length).toBeLessThanOrEqual(400);

    expect(mapPostgrestError(null, { entity: "products", action: "create" })).toMatchObject(
      { status: 500 }
    );
  });
});

describe("operaciones sin servidor configurado", () => {
  it("informa qué variable falta (503) antes de tocar la red", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.resetModules();
    const fresh = await import("@/lib/server/catalogWriteService");

    await expect(fresh.createEntity("genders", { id: "x", name: "X" })).rejects.toMatchObject(
      { status: 503, code: "CONFIG" }
    );
    await expect(
      fresh.updateEntity("genders", "x", { id: "x", name: "X" })
    ).rejects.toMatchObject({
      status: 503,
    });
    await expect(fresh.deleteEntity("genders", "x")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("rechaza payloads inválidos ANTES de configurar el cliente (ValidationError → 400)", async () => {
    await expect(createEntity("genders", { name: "Sin id" })).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(updateEntity("genders", "x", null)).rejects.toMatchObject({
      status: 400,
    });
    await expect(deleteEntity("genders", "   ")).rejects.toMatchObject({
      status: 400,
    });
  });
});
