import { describe, expect, it } from "vitest";
import type { Order, OrderStatus } from "@/types";
import {
  ALLOWED_TRANSITIONS,
  ORDER_STATUS_LABELS,
  allowedNextStatuses,
  applyStatusTransition,
  canTransition,
} from "@/lib/orderStatus";

const ALL: OrderStatus[] = [
  "no-concretado",
  "confirmado",
  "enviado",
  "entregado",
  "cancelado",
];

function order(status: OrderStatus): Order {
  return {
    id: "AV-1",
    status,
    statusHistory: [{ status: "no-concretado", date: "2026-10-01T10:00:00.000Z" }],
  } as unknown as Order;
}

describe("canTransition — máquina de estados", () => {
  it("permite el ciclo principal", () => {
    expect(canTransition("no-concretado", "confirmado")).toBe(true);
    expect(canTransition("confirmado", "enviado")).toBe(true);
    expect(canTransition("enviado", "entregado")).toBe(true);
  });

  it("permite cancelar desde pendiente o confirmado", () => {
    expect(canTransition("no-concretado", "cancelado")).toBe(true);
    expect(canTransition("confirmado", "cancelado")).toBe(true);
  });

  it("bloquea saltos inválidos", () => {
    expect(canTransition("no-concretado", "enviado")).toBe(false);
    expect(canTransition("no-concretado", "entregado")).toBe(false);
    expect(canTransition("confirmado", "entregado")).toBe(false);
    expect(canTransition("enviado", "confirmado")).toBe(false);
  });

  it("entregado y cancelado son estados terminales", () => {
    for (const target of ALL) {
      expect(canTransition("entregado", target)).toBe(false);
      expect(canTransition("cancelado", target)).toBe(false);
    }
  });

  it("una venta entregada no puede reabrirse ni re-confirmarse", () => {
    expect(ALLOWED_TRANSITIONS.entregado).toHaveLength(0);
    expect(ALLOWED_TRANSITIONS.cancelado).toHaveLength(0);
  });
});

describe("allowedNextStatuses", () => {
  it("ofrece exactamente las transiciones permitidas", () => {
    expect(allowedNextStatuses("no-concretado").sort()).toEqual([
      "cancelado",
      "confirmado",
    ]);
    expect(allowedNextStatuses("confirmado").sort()).toEqual([
      "cancelado",
      "enviado",
    ]);
    expect(allowedNextStatuses("enviado")).toEqual(["entregado"]);
    expect(allowedNextStatuses("entregado")).toEqual([]);
  });

  it("todas las etiquetas están definidas", () => {
    for (const status of ALL) {
      expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("applyStatusTransition", () => {
  it("aplica la transición y agrega el evento al historial", () => {
    const updated = applyStatusTransition(
      order("confirmado"),
      "enviado",
      "2026-10-17T12:00:00.000Z"
    );
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe("enviado");
    expect(updated?.statusHistory).toHaveLength(2);
    expect(updated?.statusHistory[1]).toEqual({
      status: "enviado",
      date: "2026-10-17T12:00:00.000Z",
    });
  });

  it("devuelve null (y no persiste nada) ante una transición inválida", () => {
    expect(applyStatusTransition(order("entregado"), "enviado")).toBeNull();
    expect(applyStatusTransition(order("no-concretado"), "entregado")).toBeNull();
    expect(applyStatusTransition(order("cancelado"), "confirmado")).toBeNull();
  });

  it("no muta el pedido original", () => {
    const original = order("confirmado");
    applyStatusTransition(original, "enviado");
    expect(original.status).toBe("confirmado");
    expect(original.statusHistory).toHaveLength(1);
  });
});
