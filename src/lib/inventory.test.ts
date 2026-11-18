/**
 * Pruebas de inventario (reserva/liberación de stock) — funciones puras.
 * Estos tests cubren el defecto corregido: los pedidos no descontaban stock
 * ni acumulaban ventas, y las cancelaciones no devolvían unidades.
 */
import { describe, expect, it } from "vitest";
import { releaseStock, reserveStock, type InventoryLine } from "@/lib/inventory";
import type { Product } from "@/types";

function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    name: `Producto ${overrides.id}`,
    slug: `producto-${overrides.id}`,
    price: 15000,
    stock: 10,
    soldCount: 5,
    images: ["/img/test.jpg"],
    categories: ["perfumes"],
    brand: "marca-test",
    gender: "unisex",
    olfactoryFamily: "Amaderado",
    concentration: "Eau de Parfum",
    size: "100ml",
    description: "Descripción de prueba",
    notes: { top: ["Salida"], heart: ["Corazón"], base: ["Fondo"] },
    featured: false,
    isActive: true,
    isOnSale: false,
    isNew: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("reserveStock", () => {
  it("descuenta el stock y acumula las unidades vendidas", () => {
    const products = [makeProduct({ id: "p1", stock: 10, soldCount: 5 })];
    const lines: InventoryLine[] = [{ productId: "p1", quantity: 3 }];

    const result = reserveStock(products, lines);

    expect(result.products[0].stock).toBe(7);
    expect(result.products[0].soldCount).toBe(8);
    expect(result.updatedIds).toEqual(["p1"]);
  });

  it("nunca deja el stock en negativo (se limita a 0)", () => {
    const products = [makeProduct({ id: "p1", stock: 1, soldCount: 0 })];
    const lines: InventoryLine[] = [{ productId: "p1", quantity: 5 }];

    const result = reserveStock(products, lines);

    expect(result.products[0].stock).toBe(0);
    expect(result.products[0].soldCount).toBe(5);
  });

  it("suma las cantidades de líneas repetidas del mismo producto", () => {
    const products = [makeProduct({ id: "p1", stock: 10 })];
    const lines: InventoryLine[] = [
      { productId: "p1", quantity: 2 },
      { productId: "p1", quantity: 4 },
    ];

    const result = reserveStock(products, lines);

    expect(result.products[0].stock).toBe(4);
    expect(result.updatedIds).toEqual(["p1"]);
  });

  it("ignora cantidades inválidas (0, negativas, NaN) y líneas sin producto", () => {
    const products = [makeProduct({ id: "p1", stock: 10, soldCount: 5 })];
    const lines = [
      { productId: "p1", quantity: 0 },
      { productId: "p1", quantity: -2 },
      { productId: "p1", quantity: Number.NaN },
      { productId: "   ", quantity: 3 },
      { productId: "p2", quantity: 1 }, // producto inexistente → se omite
    ] as InventoryLine[];

    const result = reserveStock(products, lines);

    expect(result.products[0].stock).toBe(10);
    expect(result.products[0].soldCount).toBe(5);
    expect(result.updatedIds).toEqual([]);
  });

  it("no muta el arreglo de entrada", () => {
    const products = [makeProduct({ id: "p1", stock: 10 })];
    const original = [...products];

    reserveStock(products, [{ productId: "p1", quantity: 2 }]);

    expect(products).toEqual(original);
    expect(products[0].stock).toBe(10);
  });

  it("trata un soldCount ausente como 0", () => {
    const product = makeProduct({ id: "p1", stock: 10 });
    delete (product as { soldCount?: number }).soldCount;

    const result = reserveStock([product], [{ productId: "p1", quantity: 2 }]);

    expect(result.products[0].soldCount).toBe(2);
  });
});

describe("releaseStock", () => {
  it("devuelve las unidades al stock y descuenta las ventas", () => {
    const products = [makeProduct({ id: "p1", stock: 7, soldCount: 8 })];
    const lines: InventoryLine[] = [{ productId: "p1", quantity: 3 }];

    const result = releaseStock(products, lines);

    expect(result.products[0].stock).toBe(10);
    expect(result.products[0].soldCount).toBe(5);
    expect(result.updatedIds).toEqual(["p1"]);
  });

  it("nunca deja soldCount en negativo", () => {
    const products = [makeProduct({ id: "p1", stock: 0, soldCount: 1 })];
    const lines: InventoryLine[] = [{ productId: "p1", quantity: 4 }];

    const result = releaseStock(products, lines);

    expect(result.products[0].stock).toBe(4);
    expect(result.products[0].soldCount).toBe(0);
  });

  it("omite productos que ya no existen en el catálogo", () => {
    const products = [makeProduct({ id: "p1", stock: 7 })];
    const lines: InventoryLine[] = [{ productId: "dado-de-baja", quantity: 2 }];

    const result = releaseStock(products, lines);

    expect(result.updatedIds).toEqual([]);
    expect(result.products[0].stock).toBe(7);
  });

  it("reserva y liberación son inversas para un caso normal", () => {
    const products = [makeProduct({ id: "p1", stock: 10, soldCount: 5 })];
    const lines: InventoryLine[] = [{ productId: "p1", quantity: 3 }];

    const reserved = reserveStock(products, lines);
    const restored = releaseStock(reserved.products, lines);

    expect(restored.products).toEqual(products);
  });
});
