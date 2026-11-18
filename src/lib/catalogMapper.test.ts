/**
 * Tests del mapeo filas Supabase → tipos de la app (Fase C-1)
 * Importantes: la conversión centavos↔pesos y la agrupación de
 * product_categories son los dos puntos donde un error rompería precios o
 * categorías del catálogo.
 */
import { describe, it, expect } from "vitest";
import {
  arsToCents,
  brandRowToBrand,
  centsToArs,
  categoryRowToCategory,
  genderRowToGender,
  productRowToProduct,
  rowsToProducts,
  type BrandRow,
  type CategoryRow,
  type GenderRow,
  type ProductCategoryRow,
  type ProductRow,
} from "@/lib/catalogMapper";

const genderRow: GenderRow = { id: "hombre", name: "Hombre", is_active: true };
const categoryRow: CategoryRow = {
  id: "hombre",
  slug: "hombre",
  name: "Hombre",
  description: "Fragancias masculinas",
  image_url: "https://img/hombre.jpg",
  order: 1,
  is_active: true,
};
const brandRow: BrandRow = {
  id: "dior",
  slug: "dior",
  name: "Dior",
  description: null,
  image_url: null,
  order: 1,
  is_active: false,
};

function makeProductRow(overrides: Partial<ProductRow> = {}): ProductRow {
  return {
    id: "1",
    slug: "dior-sauvage-edt-100",
    name: "Sauvage",
    brand_id: "dior",
    gender_id: "hombre",
    description: "Una fragancia salvaje",
    long_description: null,
    price_cents: 14500000,
    previous_price_cents: 16500000,
    discount: 12,
    images: ["https://img/1.jpg"],
    size: "100 ml",
    concentration: "Eau de Toilette",
    olfactory_family: "Amaderado Aromático",
    notes_top: ["Bergamota"],
    notes_heart: ["Lavanda"],
    notes_base: ["Ambroxan"],
    stock: 8,
    featured: true,
    is_active: true,
    is_on_sale: true,
    is_new: false,
    sold_count: 45,
    created_at: "2024-01-15T00:00:00+00:00",
    ...overrides,
  };
}

describe("conversión de importes (centavos <-> pesos)", () => {
  it("convierte centavos enteros a pesos enteros", () => {
    expect(centsToArs(14500000)).toBe(145000);
    expect(centsToArs(0)).toBe(0);
    expect(centsToArs(12345)).toBe(123); // redondeo
  });

  it("maneja null/undefined como ausencia", () => {
    expect(centsToArs(null)).toBeUndefined();
    expect(centsToArs(undefined)).toBeUndefined();
    expect(arsToCents(null)).toBeNull();
    expect(arsToCents(undefined)).toBeNull();
  });

  it("es inversa exacta para precios enteros de pesos (los de la app)", () => {
    for (const ars of [0, 1, 145000, 999999, 3200000]) {
      expect(centsToArs(arsToCents(ars))).toBe(ars);
    }
  });
});

describe("filas simples → modelos", () => {
  it("mapea gender", () => {
    expect(genderRowToGender(genderRow)).toEqual({
      id: "hombre",
      name: "Hombre",
      isActive: true,
    });
  });

  it("mapea category y convierte nulls en strings vacíos", () => {
    const result = categoryRowToCategory({
      ...categoryRow,
      description: null,
      image_url: null,
    });
    expect(result.description).toBe("");
    expect(result.image).toBe("");
    expect(result.isActive).toBe(true);
    expect(result.order).toBe(1);
    // parentId no existe en el esquema: el modelo lo deja ausente.
    expect("parentId" in result).toBe(false);
  });

  it("mapea brand y convierte nulls en undefined (opcionales)", () => {
    const result = brandRowToBrand(brandRow);
    expect(result.description).toBeUndefined();
    expect(result.image).toBeUndefined();
    expect(result.isActive).toBe(false);
  });
});

describe("producto con categorías", () => {
  it("mapea todos los campos, precios en pesos y notas anidadas", () => {
    const product = productRowToProduct(makeProductRow(), ["hombre", "ofertas"]);
    expect(product.price).toBe(145000);
    expect(product.previousPrice).toBe(165000);
    expect(product.discount).toBe(12);
    expect(product.categories).toEqual(["hombre", "ofertas"]);
    expect(product.brand).toBe("dior");
    expect(product.gender).toBe("hombre");
    expect(product.notes).toEqual({
      top: ["Bergamota"],
      heart: ["Lavanda"],
      base: ["Ambroxan"],
    });
    expect(product.soldCount).toBe(45);
    expect(product.longDescription).toBeUndefined();
    expect(product.isActive).toBe(true);
    expect(product.isOnSale).toBe(true);
    expect(product.isNew).toBe(false);
  });

  it("tolera campos obligatorios del modelo como null en la fila", () => {
    const product = productRowToProduct(
      makeProductRow({ size: null, concentration: null, olfactory_family: null, description: null }),
      []
    );
    expect(product.size).toBe("");
    expect(product.concentration).toBe("");
    expect(product.olfactoryFamily).toBe("");
    expect(product.description).toBe("");
    expect(product.categories).toEqual([]);
  });

  it("no comparte referencias del arreglo de categorías de entrada", () => {
    const ids = ["hombre"];
    const product = productRowToProduct(makeProductRow(), ids);
    product.categories.push("ofertas");
    expect(ids).toEqual(["hombre"]);
  });
});

describe("rowsToProducts (agrupación de product_categories)", () => {
  const links: ProductCategoryRow[] = [
    { product_id: "1", category_id: "hombre" },
    { product_id: "2", category_id: "mujer" },
    { product_id: "1", category_id: "ofertas" },
  ];

  it("agrupa por producto sin N+1 y en orden de llegada", () => {
    const [p1, p2] = rowsToProducts(
      [makeProductRow(), makeProductRow({ id: "2" })],
      links
    );
    expect(p1?.categories).toEqual(["hombre", "ofertas"]);
    expect(p2?.categories).toEqual(["mujer"]);
  });

  it("producto sin vínculos queda con categorías vacías", () => {
    const [only] = rowsToProducts([makeProductRow()], []);
    expect(only?.categories).toEqual([]);
  });

  it("vínculos huérfanos no generan productos fantasma", () => {
    const products = rowsToProducts([makeProductRow()], [
      { product_id: "999", category_id: "hombre" },
    ]);
    expect(products).toHaveLength(1);
    expect(products[0]?.categories).toEqual([]);
  });
});
