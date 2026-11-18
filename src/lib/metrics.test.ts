import { describe, expect, it } from "vitest";
import type { Order, OrderStatus, Product } from "@/types";
import {
  CONFIRMED_SALE_STATUSES,
  DEFAULT_LOW_STOCK_THRESHOLD,
  computeDashboardMetrics,
  isConfirmedSale,
} from "@/lib/metrics";

function order(
  status: OrderStatus,
  total: number,
  date: string
): Order {
  return { status, total, date } as unknown as Order;
}

function product(stock: number): Product {
  return { stock } as unknown as Product;
}

const NOW = new Date("2026-10-17T12:00:00.000Z");

describe("isConfirmedSale", () => {
  it("confirma solo los estados de venta efectiva", () => {
    expect(isConfirmedSale("confirmado")).toBe(true);
    expect(isConfirmedSale("enviado")).toBe(true);
    expect(isConfirmedSale("entregado")).toBe(true);
  });

  it("excluye pendientes y cancelados", () => {
    expect(isConfirmedSale("no-concretado")).toBe(false);
    expect(isConfirmedSale("cancelado")).toBe(false);
  });

  it("la lista confirmada no contiene estados excluidos", () => {
    expect(CONFIRMED_SALE_STATUSES).not.toContain("cancelado");
    expect(CONFIRMED_SALE_STATUSES).not.toContain("no-concretado");
  });
});

describe("computeDashboardMetrics — ingresos y ticket", () => {
  it("suma solo pedidos confirmados", () => {
    const orders = [
      order("confirmado", 10_000, "2026-10-16T10:00:00.000Z"),
      order("enviado", 5_000, "2026-10-16T11:00:00.000Z"),
      order("cancelado", 99_999, "2026-10-16T12:00:00.000Z"),
      order("no-concretado", 77_777, "2026-10-17T09:00:00.000Z"),
    ];

    const m = computeDashboardMetrics(orders, [], { now: NOW });

    expect(m.confirmedOrders).toBe(2);
    expect(m.confirmedRevenue).toBe(15_000);
    expect(m.pendingOrders).toBe(1);
    expect(m.cancelledOrders).toBe(1);
    expect(m.totalOrders).toBe(4);
  });

  it("calcula el ticket promedio de confirmados", () => {
    const orders = [
      order("confirmado", 1_000, "2026-10-16T10:00:00.000Z"),
      order("entregado", 2_000, "2026-10-16T10:00:00.000Z"),
    ];
    const m = computeDashboardMetrics(orders, [], { now: NOW });
    expect(m.averageTicket).toBe(1_500);
  });

  it("ticket promedio es 0 sin ventas confirmadas", () => {
    const m = computeDashboardMetrics(
      [order("cancelado", 500, "2026-10-16T10:00:00.000Z")],
      [],
      { now: NOW }
    );
    expect(m.averageTicket).toBe(0);
    expect(m.confirmedRevenue).toBe(0);
  });
});

describe("computeDashboardMetrics — evolución diaria", () => {
  it("genera la cantidad de días pedida, con ceros para los vacíos", () => {
    const m = computeDashboardMetrics([], [], { now: NOW, days: 7 });
    expect(m.salesByDay).toHaveLength(7);
    expect(m.salesByDay.map((d) => d.date)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
    expect(m.salesByDay.every((d) => d.orders === 0 && d.revenue === 0)).toBe(true);
  });

  it("agrupa por día y descarta pedidos cancelados", () => {
    const orders = [
      order("confirmado", 1_000, "2026-10-16T08:00:00.000Z"),
      order("enviado", 2_000, "2026-10-16T22:30:00.000Z"),
      order("cancelado", 4_000, "2026-10-16T09:00:00.000Z"),
    ];
    const m = computeDashboardMetrics(orders, [], { now: NOW, days: 7 });
    const day = m.salesByDay.find((d) => d.date === "2026-10-16");
    expect(day).toEqual({ date: "2026-10-16", orders: 2, revenue: 3_000 });
  });

  it("ignora fechas inválidas sin romper", () => {
    const m = computeDashboardMetrics(
      [order("confirmado", 100, "fecha-invalida")],
      [],
      { now: NOW, days: 3 }
    );
    expect(m.salesByDay).toHaveLength(3);
    expect(m.salesByDay.every((d) => d.orders === 0)).toBe(true);
  });
});

describe("computeDashboardMetrics — stock", () => {
  it("cuenta stock bajo y agotados según el umbral", () => {
    const products = [
      product(0),
      product(1),
      product(DEFAULT_LOW_STOCK_THRESHOLD),
      product(DEFAULT_LOW_STOCK_THRESHOLD + 1),
      product(100),
    ];
    const m = computeDashboardMetrics([], products, { now: NOW });
    expect(m.outOfStockProducts).toBe(1);
    expect(m.lowStockProducts).toBe(2); // stock 1 y stock == umbral
  });

  it("respeta un umbral personalizado", () => {
    const m = computeDashboardMetrics([], [product(6)], {
      now: NOW,
      lowStockThreshold: 5,
    });
    expect(m.lowStockProducts).toBe(0);
    expect(
      computeDashboardMetrics([], [product(6)], {
        now: NOW,
        lowStockThreshold: 6,
      }).lowStockProducts
    ).toBe(1);
  });
});
