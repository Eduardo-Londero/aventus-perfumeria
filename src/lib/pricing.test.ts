import { describe, expect, it } from "vitest";
import { siteConfig } from "@/config/site";
import {
  clampQuantity,
  computeShipping,
  computeSubtotal,
  computeTotal,
  findStockIssues,
  freeShippingProgress,
  freeShippingRemaining,
} from "@/lib/pricing";

const { freeThreshold, defaultCost } = siteConfig.shipping;

describe("computeSubtotal", () => {
  it("suma precio por cantidad de cada línea", () => {
    expect(
      computeSubtotal([
        { price: 1000, quantity: 2 },
        { price: 350, quantity: 1 },
      ])
    ).toBe(2350);
  });

  it("devuelve 0 con carrito vacío", () => {
    expect(computeSubtotal([])).toBe(0);
  });

  it("ignora cantidades negativas (no resta importe)", () => {
    expect(computeSubtotal([{ price: 1000, quantity: -5 }])).toBe(0);
  });
});

describe("computeShipping — retiro en local", () => {
  it("siempre cuesta 0", () => {
    expect(computeShipping(0, "retiro")).toBe(0);
    expect(computeShipping(10_000, "retiro")).toBe(0);
    expect(computeShipping(freeThreshold, "retiro")).toBe(0);
  });
});

describe("computeShipping — envío a domicilio", () => {
  it("aplica el costo por defecto bajo el umbral", () => {
    expect(computeShipping(1, "envio")).toBe(defaultCost);
    expect(computeShipping(freeThreshold - 1, "envio")).toBe(defaultCost);
  });

  it("es gratis desde el umbral en adelante", () => {
    expect(computeShipping(freeThreshold, "envio")).toBe(0);
    expect(computeShipping(freeThreshold + 1, "envio")).toBe(0);
  });

  it("no cobra envío con carrito vacío", () => {
    expect(computeShipping(0, "envio")).toBe(0);
  });
});

describe("computeTotal", () => {
  it("es subtotal + envío según el método de entrega", () => {
    const subtotal = freeThreshold - 1;
    expect(computeTotal(subtotal, "envio")).toBe(subtotal + defaultCost);
    expect(computeTotal(subtotal, "retiro")).toBe(subtotal);
  });
});

describe("helpers de envío gratis", () => {
  it("indica cuánto falta y el progreso", () => {
    expect(freeShippingRemaining(freeThreshold - 500)).toBe(500);
    expect(freeShippingRemaining(freeThreshold)).toBe(0);
    expect(freeShippingProgress(0)).toBe(0);
    expect(freeShippingProgress(freeThreshold)).toBe(100);
    expect(freeShippingProgress(freeThreshold * 2)).toBe(100);
  });
});

describe("clampQuantity — límite de stock", () => {
  it("limita al stock disponible", () => {
    expect(clampQuantity(10, 3)).toBe(3);
  });

  it("no baja de 1 cuando hay stock", () => {
    expect(clampQuantity(0, 5)).toBe(1);
    expect(clampQuantity(-2, 5)).toBe(1);
  });

  it("devuelve 0 cuando no hay stock", () => {
    expect(clampQuantity(3, 0)).toBe(0);
  });

  it("trunca fracciones", () => {
    expect(clampQuantity(2.7, 10)).toBe(2);
  });
});

describe("findStockIssues — revalidación en checkout", () => {
  it("no reporta nada cuando todo el stock alcanza", () => {
    expect(
      findStockIssues([
        { productId: "a", quantity: 2, stock: 2 },
        { productId: "b", quantity: 1, stock: 9 },
      ])
    ).toEqual([]);
  });

  it("reporta la línea que supera el stock", () => {
    expect(
      findStockIssues([
        { productId: "a", quantity: 5, stock: 2 },
        { productId: "b", quantity: 1, stock: 1 },
      ])
    ).toEqual([{ productId: "a", requested: 5, available: 2 }]);
  });

  it("reporta productos agotados aunque la cantidad sea 0", () => {
    expect(
      findStockIssues([{ productId: "x", quantity: 0, stock: 0 }])
    ).toEqual([{ productId: "x", requested: 0, available: 0 }]);
  });
});
