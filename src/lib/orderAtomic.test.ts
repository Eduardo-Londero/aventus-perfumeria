import { describe, expect, it } from "vitest";
import {
  createOrderStore,
  createOrderAtomic,
  getOrderForUser,
  confirmPayment,
  type ProductRecord,
} from "@/lib/orderAtomic";

const products: ProductRecord[] = [
  { id: "p1", name: "Sauvage", brand: "Dior", image: "img", price: 100, stock: 5, isActive: true },
  { id: "p2", name: "Acqua", brand: "Bvlgari", image: "img2", price: 50, stock: 1, isActive: true },
  { id: "p3", name: "Inactivo", brand: "X", image: "img3", price: 10, stock: 5, isActive: false },
];

function store() {
  return createOrderStore(products.map((p) => ({ ...p })));
}

const customer = {
  name: "Ana",
  lastName: "Pérez",
  phone: "115",
  email: "ana@test",
  address: "Calle 1",
  city: "BA",
  postalCode: "1000",
};

describe("orderAtomic · usuario autenticado", () => {
  it("crea pedido con precios del servidor y pago pending", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 2, clientPrice: 999 }],
      deliveryMethod: "envio",
      paymentMethod: "transferencia",
      customer,
      userId: "user-uuid",
      idempotencyKey: "k1",
    });
    expect(r.ok).toBe(true);
    expect(r.priceMismatch).toBe(true);
    expect(r.order!.subtotal).toBe(200);
    expect(r.order!.paymentStatus).toBe("pending");
    expect(r.order!.fulfillmentStatus).toBe("awaiting_payment");
    expect(s.products.get("p1")!.stock).toBe(3);
  });
});

describe("orderAtomic · invitado", () => {
  it("permite comprar sin userId", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "Inv", lastName: "Itado", phone: "1", email: "i@t" },
      userId: null,
    });
    expect(r.ok).toBe(true);
    expect(r.order!.userId).toBeNull();
  });
});

describe("orderAtomic · producto inexistente/inactivo", () => {
  it("rechaza producto inexistente", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "nope", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe("product_not_found");
    expect(s.orders.size).toBe(0);
  });
  it("rechaza producto inactivo", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p3", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe("product_inactive");
  });
});

describe("orderAtomic · precio manipulado", () => {
  it("ignora clientPrice y usa el del servidor", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1, clientPrice: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(true);
    expect(r.order!.subtotal).toBe(100);
    expect(r.priceMismatch).toBe(true);
  });
});

describe("orderAtomic · stock insuficiente", () => {
  it("rechaza y no modifica stock", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p2", quantity: 2 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe("insufficient_stock");
    expect(s.products.get("p2")!.stock).toBe(1);
    expect(s.orders.size).toBe(0);
  });
});

describe("orderAtomic · concurrencia (última unidad)", () => {
  it("la segunda compra falla sin stock negativo", () => {
    const s = store();
    const r1 = createOrderAtomic(s, {
      items: [{ productId: "p2", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    const r2 = createOrderAtomic(s, {
      items: [{ productId: "p2", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "c", lastName: "d", phone: "2", email: "c@d" },
      userId: null,
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(r2.error!.code).toBe("insufficient_stock");
    expect(s.products.get("p2")!.stock).toBe(0);
  });
});

describe("orderAtomic · rollback ante error intermedio", () => {
  it("no deja stock parcial ni pedido", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }, { productId: "p2", quantity: 5 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(false);
    expect(s.products.get("p1")!.stock).toBe(5);
    expect(s.orders.size).toBe(0);
  });
});

describe("orderAtomic · idempotencia", () => {
  it("replay devuelve el mismo pedido", () => {
    const s = store();
    const r1 = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
      idempotencyKey: "dup",
    });
    const r2 = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
      idempotencyKey: "dup",
    });
    expect(r1.ok && r2.ok).toBe(true);
    expect(r2.idempotent).toBe(true);
    expect(r2.order!.id).toBe(r1.order!.id);
    expect(s.products.get("p1")!.stock).toBe(4);
  });
  it("idempotency key de otro usuario -> conflicto", () => {
    const s = store();
    createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: "owner",
      idempotencyKey: "shared",
    });
    const r2 = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "c", lastName: "d", phone: "2", email: "c@d" },
      userId: "other",
      idempotencyKey: "shared",
    });
    expect(r2.ok).toBe(false);
    expect(r2.error!.code).toBe("idempotency_conflict");
  });
});

describe("orderAtomic · aislamiento de pedidos", () => {
  it("usuario no puede leer pedido ajeno", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: "owner",
    });
    expect(getOrderForUser(s, r.order!.id, "other", false)).toBeNull();
    expect(getOrderForUser(s, r.order!.id, "owner", false)).not.toBeNull();
    expect(getOrderForUser(s, r.order!.id, "any", true)).not.toBeNull();
  });
  it("invitado no puede leer pedido de otro", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(getOrderForUser(s, r.order!.id, "user-x", false)).toBeNull();
  });
});

describe("orderAtomic · pagos", () => {
  it("creación nunca marca pago como confirmado", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "transferencia",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.order!.paymentStatus).toBe("pending");
  });
  it("confirmPayment paid -> processing", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "transferencia",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    const c = confirmPayment(s, r.order!.id, "paid", "admin");
    expect(c.ok).toBe(true);
    expect(s.orders.get(r.order!.id)!.paymentStatus).toBe("paid");
    expect(s.orders.get(r.order!.id)!.fulfillmentStatus).toBe("processing");
  });
  it("confirmPayment rejected -> cancelled + stock liberado", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p2", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "transferencia",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    const before = s.products.get("p2")!.stock;
    const c = confirmPayment(s, r.order!.id, "rejected", "admin");
    expect(c.ok).toBe(true);
    expect(s.orders.get(r.order!.id)!.paymentStatus).toBe("rejected");
    expect(s.orders.get(r.order!.id)!.fulfillmentStatus).toBe("cancelled");
    expect(s.products.get("p2")!.stock).toBe(before + 1);
  });
});

describe("orderAtomic · notificación duplicada", () => {
  it("reintentos no duplican pedido ni stock", () => {
    const s = store();
    createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "transferencia",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
      idempotencyKey: "notif-1",
    });
    const r2 = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "retiro",
      paymentMethod: "transferencia",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
      idempotencyKey: "notif-1",
    });
    expect(s.orders.size).toBe(1);
    expect(s.products.get("p1")!.stock).toBe(4);
    expect(r2.idempotent).toBe(true);
  });
});

describe("orderAtomic · dirección envío", () => {
  it("requiere dirección para envío", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 1 }],
      deliveryMethod: "envio",
      paymentMethod: "efectivo",
      customer: { name: "a", lastName: "b", phone: "1", email: "a@b" },
      userId: null,
    });
    expect(r.ok).toBe(false);
    expect(r.error!.code).toBe("shipping_address_required");
  });
});

describe("orderAtomic · consistencia", () => {
  it("pedido, ítems, historial y stock son consistentes", () => {
    const s = store();
    const r = createOrderAtomic(s, {
      items: [{ productId: "p1", quantity: 2 }],
      deliveryMethod: "envio",
      paymentMethod: "transferencia",
      customer,
      userId: "u1",
    });
    expect(r.ok).toBe(true);
    const id = r.order!.id;
    expect(s.items.get(id)).toHaveLength(1);
    expect(s.history.get(id)).toHaveLength(1);
    expect(s.items.get(id)![0].subtotal).toBe(200);
    expect(s.products.get("p1")!.stock).toBe(3);
  });
});
