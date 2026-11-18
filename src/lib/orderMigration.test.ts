import { describe, expect, it } from "vitest";
import type { Order } from "@/types";
import {
  LEGACY_STATUS_TO_FULFILLMENT,
  LEGACY_STATUS_TO_PAYMENT,
  isUuid,
  legacyOrderUuid,
  migrateOrder,
  planOrderMigration,
} from "@/lib/orderMigration";

const baseOrder: Order = {
  id: "AV-1048",
  date: "2026-10-18T12:00:00.000Z",
  customer: {
    name: "Ana",
    lastName: "Pérez",
    phone: "115555",
    email: "ana@test",
    address: "Calle 1 2 3",
    city: "Buenos Aires",
    postalCode: "1000",
  },
  items: [
    {
      productId: "p1",
      name: "Sauvage",
      brand: "Dior",
      image: "https://example.test/x.jpg",
      size: "100 ml",
      quantity: 2,
      unitPrice: 100,
      subtotal: 200,
    },
  ],
  subtotal: 200,
  shippingCost: 50,
  total: 250,
  deliveryMethod: "envio",
  paymentMethod: "transferencia",
  status: "entregado",
  statusHistory: [{ status: "entregado", date: "2026-10-18T12:00:00.000Z" }],
  userId: "11111111-2222-4333-8444-555555555555",
  stockReserved: true,
};

describe("orderMigration · isUuid", () => {
  it("acepta uuid canónico", () => {
    expect(isUuid("11111111-2222-4333-8444-555555555555")).toBe(true);
  });
  it("rechaza id local", () => {
    expect(isUuid("user-123")).toBe(false);
    expect(isUuid("customer-1")).toBe(false);
  });
});

describe("orderMigration · mapas de estado", () => {
  it("cubre los 5 estados legacy en ambos ejes", () => {
    const statuses = [
      "no-concretado",
      "confirmado",
      "enviado",
      "entregado",
      "cancelado",
    ] as const;
    for (const s of statuses) {
      expect(LEGACY_STATUS_TO_FULFILLMENT[s]).toBeTruthy();
      expect(LEGACY_STATUS_TO_PAYMENT[s]).toBeTruthy();
    }
  });
  it("entregado → paid/delivered", () => {
    expect(LEGACY_STATUS_TO_PAYMENT.entregado).toBe("paid");
    expect(LEGACY_STATUS_TO_FULFILLMENT.entregado).toBe("delivered");
  });
});

describe("orderMigration · legacyOrderUuid", () => {
  it("determinístico", () => {
    expect(legacyOrderUuid("AV-1048")).toBe(legacyOrderUuid("AV-1048"));
  });
  it("formato uuid", () => {
    expect(legacyOrderUuid("AV-1048")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

describe("orderMigration · migrateOrder", () => {
  it("pedido completo válido → ready con filas y cents", () => {
    const r = migrateOrder(baseOrder);
    expect(r.status).toBe("ready");
    expect(r.blockers).toEqual([]);
    expect(r.rows).not.toBeNull();
    expect(r.rows!.order.subtotal_cents).toBe(20000);
    expect(r.rows!.order.shipping_cents).toBe(5000);
    expect(r.rows!.order.total_cents).toBe(25000);
    expect(r.rows!.order.user_id).toBe(baseOrder.userId);
    expect(r.rows!.order.stock_released).toBe(false);
    expect(r.rows!.items).toHaveLength(1);
    expect(r.rows!.items[0].line_total_cents).toBe(20000);
    expect(r.rows!.history).toHaveLength(1);
  });

  it("pedido de invitado → bloqueado guest_order", () => {
    const o = { ...baseOrder, userId: undefined };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("guest_order");
    expect(r.rows).toBeNull();
  });

  it("userId local no-uuid → bloqueado user_id_not_uuid", () => {
    const o = { ...baseOrder, userId: "user-123" };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("user_id_not_uuid");
  });

  it("medio de pago desconocido → bloqueado", () => {
    const o = { ...baseOrder, paymentMethod: "bitcoin" };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("payment_method_invalid");
  });

  it("envío sin dirección → bloqueado", () => {
    const o = {
      ...baseOrder,
      deliveryMethod: "envio" as const,
      customer: { ...baseOrder.customer, address: "", city: "", postalCode: "" },
    };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("shipping_address_incomplete");
  });

  it("monto negativo → bloqueado amount_invalid", () => {
    const o = { ...baseOrder, total: -1 };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("amount_invalid");
  });

  it("total ≠ subtotal+shipping → warning total_mismatch", () => {
    const o = { ...baseOrder, total: 999 };
    const r = migrateOrder(o);
    expect(r.status).toBe("ready");
    expect(r.warnings).toContain("total_mismatch");
  });

  it("email presente → warning pii_email_not_stored", () => {
    const r = migrateOrder(baseOrder);
    expect(r.warnings).toContain("pii_email_not_stored");
  });

  it("item con cantidad inválida → bloqueado", () => {
    const o = {
      ...baseOrder,
      items: [{ ...baseOrder.items[0], quantity: 0 }],
    };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("item_quantity_invalid");
  });

  it("item sin nombre → bloqueado", () => {
    const o = {
      ...baseOrder,
      items: [{ ...baseOrder.items[0], name: "" }],
    };
    const r = migrateOrder(o);
    expect(r.status).toBe("blocked");
    expect(r.blockers).toContain("item_missing_fields");
  });

  it("historial vacío → warning status_history_missing y se sintetiza", () => {
    const o = { ...baseOrder, statusHistory: [] as any };
    const r = migrateOrder(o);
    expect(r.status).toBe("ready");
    expect(r.warnings).toContain("status_history_missing");
    expect(r.rows!.history).toHaveLength(1);
  });

  it("historial no adyacente → warning", () => {
    const o = {
      ...baseOrder,
      status: "entregado" as const,
      statusHistory: [
        { status: "no-concretado" as const, date: "2026-10-18T10:00:00.000Z" },
        { status: "entregado" as const, date: "2026-10-18T12:00:00.000Z" },
      ],
    };
    const r = migrateOrder(o);
    expect(r.warnings).toContain("status_history_non_adjacent");
  });

  it("idempotencia: mismo input → mismo uuid", () => {
    const a = migrateOrder(baseOrder);
    const b = migrateOrder(baseOrder);
    expect(a.rows!.order.id).toBe(b.rows!.order.id);
    expect(a.rows!.items[0].id).toBe(b.rows!.items[0].id);
  });
});

describe("orderMigration · plan", () => {
  it("cuenta ready/blocked y histograma", () => {
    const plan = planOrderMigration([
      baseOrder,
      { ...baseOrder, id: "AV-1049", userId: undefined },
    ]);
    expect(plan.total).toBe(2);
    expect(plan.ready).toBe(1);
    expect(plan.blocked).toBe(1);
    expect(plan.blockers.guest_order).toBe(1);
    expect(plan.dependencies.length).toBeGreaterThan(0);
  });
});
