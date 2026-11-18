/**
 * Pruebas del módulo de exportación (Fase D)
 * ==========================================
 * `buildDump` es puro: se prueba en Node sin navegador. Los helpers de
 * navegador (`collectCollections`/`downloadDump`) quedan cubiertos por la
 * verificación manual en el informe de fase.
 */

import { describe, expect, it } from "vitest";

import {
  DUMP_FORMAT,
  DUMP_VERSION,
  buildDump,
  describeDump,
  emptyCollections,
  isDump,
  type Dump,
} from "@/lib/exportData";
import type { Category, Gender, Order, Product } from "@/types";

const product: Product = {
  id: "1",
  slug: "dior-sauvage-edt-100",
  brand: "dior",
  name: "Sauvage",
  description: "Frescura desértica.",
  price: 145000,
  images: ["https://example.test/sauvage.jpg"],
  categories: ["hombre"],
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

const category: Category = {
  id: "hombre",
  slug: "hombre",
  name: "Hombre",
  description: "Fragancias masculinas",
  image: "",
  isActive: true,
  order: 1,
};

const gender: Gender = { id: "hombre", name: "Hombre", isActive: true };

const order: Order = {
  id: "AV-1048",
  date: "2026-10-18",
  customer: { name: "Ana", lastName: "Pérez", phone: "115", email: "ana@test" },
  items: [
    {
      productId: "1",
      name: "Sauvage",
      brand: "Dior",
      image: "",
      size: "100 ml",
      quantity: 2,
      unitPrice: 145000,
      subtotal: 290000,
    },
  ],
  subtotal: 290000,
  shippingCost: 0,
  total: 290000,
  deliveryMethod: "retiro",
  paymentMethod: "transferencia",
  status: "confirmado",
  statusHistory: [{ status: "confirmado", date: "2026-10-18" }],
  stockReserved: true,
};

describe("buildDump", () => {
  it("marca el formato y la versión espejo del script de importación", () => {
    const dump = buildDump({});
    expect(dump.format).toBe(DUMP_FORMAT);
    expect(dump.format).toBe("aventus-dump");
    expect(dump.version).toBe(DUMP_VERSION);
    expect(dump.version).toBe(1);
  });

  it("acepta colecciones ausentes y las trata como vacías", () => {
    const dump = buildDump(undefined);
    expect(dump.counts).toEqual({
      products: 0,
      categories: 0,
      brands: 0,
      genders: 0,
      orders: 0,
      homeSections: 0,
      cart: 0,
    });
    expect(dump.collections.products).toEqual([]);
  });

  it("cuenta cada colección y las copia en profundidad", () => {
    const source = { products: [product], categories: [category], genders: [gender] };
    const dump = buildDump(source, { exportedAt: "2026-10-18T12:00:00.000Z" });

    expect(dump.counts.products).toBe(1);
    expect(dump.counts.categories).toBe(1);
    expect(dump.counts.genders).toBe(1);
    expect(dump.counts.orders).toBe(0);
    expect(dump.exportedAt).toBe("2026-10-18T12:00:00.000Z");

    // Deep copy: mutar el origen NO muta el dump (y viceversa).
    source.products[0].name = "Mutado";
    expect(dump.collections.products[0].name).toBe("Sauvage");
    dump.collections.products[0].stock = 999;
    expect(product.stock).toBe(8);
  });

  it("incluye pedidos y carrito en el dump completo", () => {
    const dump = buildDump({ orders: [order], cart: [{ product, quantity: 2 }] });
    expect(dump.counts.orders).toBe(1);
    expect(dump.counts.cart).toBe(1);
    expect(dump.collections.orders[0].id).toBe("AV-1048");
    expect(dump.collections.cart[0].quantity).toBe(2);
  });

  it("es JSON-serializable de ida y vuelta", () => {
    const dump = buildDump({ products: [product] });
    const roundTrip = JSON.parse(JSON.stringify(dump)) as Dump;
    expect(roundTrip).toEqual(dump);
    expect(isDump(roundTrip)).toBe(true);
  });
});

describe("isDump", () => {
  it("rechaza valores que no son un dump de esta versión", () => {
    expect(isDump(null)).toBe(false);
    expect(isDump("aventus-dump")).toBe(false);
    expect(isDump({})).toBe(false);
    expect(isDump({ format: "aventus-dump", version: 99 })).toBe(false);
  });

  it("acepta dumps de la versión actual", () => {
    expect(isDump(buildDump({}))).toBe(true);
  });
});

describe("describeDump", () => {
  it("resume los conteos en una línea", () => {
    const dump = buildDump({ products: [product], orders: [order] });
    const line = describeDump(dump);
    expect(line).toContain("1 productos");
    expect(line).toContain("1 pedidos");
    expect(line).toContain("0 marcas");
  });
});

describe("emptyCollections", () => {
  it("devuelve todas las colecciones vacías", () => {
    const empty = emptyCollections();
    expect(Object.keys(empty).sort()).toEqual(
      ["brands", "cart", "categories", "genders", "homeSections", "orders", "products"].sort()
    );
    expect(Object.values(empty).every((list) => list.length === 0)).toBe(true);
  });
});
