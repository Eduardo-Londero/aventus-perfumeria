/**
 * Pruebas del mapeo dominio ⇄ Supabase (src/lib/orderMapping.ts).
 * Cubre: importes en centavos, inversión de estados (ambos sentidos) y el
 * mapeo completo de una fila con items e historial.
 */

import { describe, it, expect } from "vitest";
import {
  centsToPesos,
  pesosToCents,
  dbToDomainStatus,
  domainToDbStatus,
  mapItemRow,
  mapOrderRow,
  type OrderRow,
  type OrderItemRow,
  type OrderHistoryRow,
} from "@/lib/orderMapping";

describe("importes: centavos ⇄ pesos ARS", () => {
  it("convierte centavos a pesos sin perder precisión", () => {
    expect(centsToPesos(14500000)).toBe(145000);
    expect(centsToPesos(14500050)).toBe(145000.5);
    expect(centsToPesos(99)).toBe(0.99);
  });

  it("convierte pesos a centavos", () => {
    expect(pesosToCents(145000)).toBe(14500000);
    expect(pesosToCents(99.99)).toBe(9999);
  });

  it("ida y vuelta es estable", () => {
    expect(centsToPesos(pesosToCents(2500))).toBe(2500);
  });
});

describe("estados: dominio → DB", () => {
  it("cada estado de negocio mapea a sus columnas", () => {
    expect(domainToDbStatus("no-concretado")).toEqual({
      payment_status: "pending",
      fulfillment_status: "awaiting_payment",
    });
    expect(domainToDbStatus("confirmado")).toEqual({
      payment_status: "paid",
      fulfillment_status: "processing",
    });
    expect(domainToDbStatus("enviado")).toEqual({
      payment_status: "paid",
      fulfillment_status: "shipped",
    });
    expect(domainToDbStatus("entregado")).toEqual({
      payment_status: "paid",
      fulfillment_status: "delivered",
    });
  });

  it("cancelar un pedido pagado lo marca refunded; sin pagar, expired", () => {
    expect(domainToDbStatus("cancelado", "paid")).toEqual({
      payment_status: "refunded",
      fulfillment_status: "cancelled",
    });
    expect(domainToDbStatus("cancelado", "pending")).toEqual({
      payment_status: "expired",
      fulfillment_status: "cancelled",
    });
    expect(domainToDbStatus("cancelado", "rejected")).toEqual({
      payment_status: "expired",
      fulfillment_status: "cancelled",
    });
  });
});

describe("estados: DB → dominio", () => {
  it("lee el eje logístico (fulfillment) como estado de negocio", () => {
    expect(dbToDomainStatus("pending", "awaiting_payment")).toBe("no-concretado");
    expect(dbToDomainStatus("paid", "processing")).toBe("confirmado");
    expect(dbToDomainStatus("paid", "ready_for_pickup")).toBe("confirmado");
    expect(dbToDomainStatus("paid", "shipped")).toBe("enviado");
    expect(dbToDomainStatus("paid", "delivered")).toBe("entregado");
    expect(dbToDomainStatus("refunded", "cancelled")).toBe("cancelado");
  });

  it("pago rechazado/expirado sin logística se lee como cancelado", () => {
    expect(dbToDomainStatus("rejected", "awaiting_payment")).toBe("cancelado");
    expect(dbToDomainStatus("expired", "awaiting_payment")).toBe("cancelado");
  });

  it("los sentidos se componen (dominio → DB → dominio)", () => {
    const estados = [
      "no-concretado",
      "confirmado",
      "enviado",
      "entregado",
    ] as const;
    for (const estado of estados) {
      const db = domainToDbStatus(estado);
      expect(dbToDomainStatus(db.payment_status, db.fulfillment_status)).toBe(
        estado
      );
    }
    // cancelado con pago pendiente (el caso inverso estable)
    const cancelado = domainToDbStatus("cancelado", "pending");
    expect(
      dbToDomainStatus(cancelado.payment_status, cancelado.fulfillment_status)
    ).toBe("cancelado");
  });
});

describe("mapOrderRow: fila completa → Order", () => {
  const baseRow: OrderRow & {
    order_items?: OrderItemRow[];
    order_status_history?: OrderHistoryRow[];
  } = {
    id: "uuid-del-pedido",
    order_number: "AV-1050",
    user_id: "uuid-del-cliente",
    delivery_method: "envio",
    payment_method: "transferencia",
    payment_status: "pending",
    fulfillment_status: "awaiting_payment",
    subtotal_cents: 29000000,
    shipping_cents: 250000,
    total_cents: 29250000,
    ship_street: "Av. Siempreviva 742",
    ship_city: "Rosario",
    ship_postal_code: "2000",
    ship_recipient_name: "Maria Gonzalez",
    ship_recipient_phone: "3415555555",
    stock_released: false,
    created_at: "2026-11-09T12:00:00+00:00",
    updated_at: "2026-11-09T12:00:00+00:00",
    order_items: [
      {
        product_id: "1",
        name: "Sauvage",
        brand_name: "Dior",
        image_url: "https://cdn/x.webp",
        size: "100ml",
        quantity: 2,
        unit_price_cents: 14500000,
        line_total_cents: 29000000,
      },
    ],
    order_status_history: [
      {
        payment_status: "pending",
        fulfillment_status: "awaiting_payment",
        created_at: "2026-11-09T12:00:00+00:00",
      },
    ],
  };

  it("traduce importes, destinatario y estado", () => {
    const order = mapOrderRow(baseRow, "maria@email.com");

    expect(order.id).toBe("AV-1050");
    expect(order.subtotal).toBe(290000);
    expect(order.shippingCost).toBe(2500);
    expect(order.total).toBe(292500);
    expect(order.customer.name).toBe("Maria");
    expect(order.customer.lastName).toBe("Gonzalez");
    expect(order.customer.email).toBe("maria@email.com");
    expect(order.customer.address).toBe("Av. Siempreviva 742");
    expect(order.status).toBe("no-concretado");
    expect(order.stockReserved).toBe(true);
    expect(order.userId).toBe("uuid-del-cliente");
  });

  it("mapea items e historial", () => {
    const order = mapOrderRow(baseRow);
    expect(order.items).toHaveLength(1);
    expect(order.items[0]).toMatchObject({
      productId: "1",
      name: "Sauvage",
      brand: "Dior",
      quantity: 2,
      unitPrice: 145000,
      subtotal: 290000,
    });
    expect(order.statusHistory).toEqual([
      { status: "no-concretado", date: "2026-11-09T12:00:00+00:00" },
    ]);
  });

  it("sin historial deja el estado actual como historia única", () => {
    const order = mapOrderRow({
      ...baseRow,
      payment_status: "paid",
      fulfillment_status: "delivered",
      order_status_history: [],
    });
    expect(order.status).toBe("entregado");
    expect(order.statusHistory).toEqual([
      { status: "entregado", date: "2026-11-09T12:00:00+00:00" },
    ]);
  });

  it("pedido liberado (cancelado) queda stockReserved=false", () => {
    const order = mapOrderRow({
      ...baseRow,
      payment_status: "expired",
      fulfillment_status: "cancelled",
      stock_released: true,
    });
    expect(order.status).toBe("cancelado");
    expect(order.stockReserved).toBe(false);
  });

  it("un destinatario vacío no rompe el mapeo", () => {
    const order = mapOrderRow({
      ...baseRow,
      ship_recipient_name: null,
      ship_recipient_phone: null,
    });
    expect(order.customer.name).toBe("");
    expect(order.customer.lastName).toBe("");
    expect(order.customer.phone).toBe("");
  });
});

describe("mapItemRow", () => {
  it("tolera image_url y size nulos", () => {
    const item = mapItemRow({
      product_id: "9",
      name: "Noir",
      brand_name: "Versace",
      image_url: null,
      size: null,
      quantity: 1,
      unit_price_cents: 100,
      line_total_cents: 100,
    });
    expect(item.image).toBe("");
    expect(item.size).toBe("");
    expect(item.unitPrice).toBe(1);
  });
});
