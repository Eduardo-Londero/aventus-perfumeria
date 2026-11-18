/**
 * Pruebas de la capa de datos de pedidos (src/lib/db.ts) en entorno node
 * ======================================================================
 * Ejecuta `dbOrders` con un localStorage simulado en memoria para verificar:
 *  - la reserva de stock al crear un pedido (defecto corregido),
 *  - la liberación exactamente una vez al cancelar,
 *  - la validación de transiciones de estado dentro de la capa de datos,
 *  - los guardas de ID duplicado y la generación de numeración sin colisiones.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dbOrders,
  dbProducts,
  initializeDatabase,
  type Order,
  type OrderItemSnapshot,
} from "@/lib/db";

// ------------------------------------------------------------
// localStorage simulado en memoria (db.ts escribe/lee en él)
// ------------------------------------------------------------
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("localStorage", storage);
// db.ts protege sus accesos con `typeof window === "undefined"`: se expone el
// global para que en este entorno node la capa de datos opere de verdad.
vi.stubGlobal("window", globalThis);

afterAll(() => {
  vi.unstubAllGlobals();
});

function makeItem(productId: string, quantity: number): OrderItemSnapshot {
  return {
    productId,
    name: "Perfume de prueba",
    brand: "marca-test",
    image: "/img/test.jpg",
    size: "100ml",
    quantity,
    unitPrice: 1000,
    subtotal: 1000 * quantity,
  };
}

function makeOrder(id: string, items: OrderItemSnapshot[]): Order {
  const now = "2026-10-18T12:00:00.000Z";
  return {
    id,
    date: now,
    customer: {
      name: "Ana",
      lastName: "Prueba",
      phone: "11-0000-0000",
      email: "ana@prueba.com",
    },
    items,
    subtotal: items.reduce((sum, i) => sum + i.subtotal, 0),
    shippingCost: 0,
    total: items.reduce((sum, i) => sum + i.subtotal, 0),
    deliveryMethod: "retiro",
    paymentMethod: "transferencia",
    status: "no-concretado",
    statusHistory: [{ status: "no-concretado", date: now }],
  };
}

/** Producto del seed con stock/ventas fijos para hacer assertions deterministas. */
function seedProduct() {
  const product = dbProducts.getAll()[0];
  expect(product).toBeDefined();
  dbProducts.update(product.id, { stock: 10, soldCount: 5 });
  const fresh = dbProducts.getById(product.id);
  if (!fresh) throw new Error("No se pudo preparar el producto de prueba");
  return fresh;
}

beforeEach(() => {
  storage.clear();
  initializeDatabase();
});

describe("dbOrders.create — reserva de stock", () => {
  it("descuenta el stock y acumula las ventas al crear un pedido", () => {
    const product = seedProduct();
    const order = makeOrder("AV-9001", [makeItem(product.id, 2)]);

    dbOrders.create(order);

    const updated = dbProducts.getById(product.id);
    expect(updated?.stock).toBe(8);
    expect(updated?.soldCount).toBe(7);

    const persisted = dbOrders.getById("AV-9001");
    expect(persisted?.stockReserved).toBe(true);
    expect(persisted?.items).toHaveLength(1);
  });

  it("nunca deja el stock en negativo", () => {
    const product = seedProduct();
    dbProducts.update(product.id, { stock: 1, soldCount: 5 });

    dbOrders.create(makeOrder("AV-9002", [makeItem(product.id, 5)]));

    const updated = dbProducts.getById(product.id);
    expect(updated?.stock).toBe(0);
    expect(updated?.soldCount).toBe(10);
  });

  it("rechaza un pedido sin ID", () => {
    expect(() => dbOrders.create(makeOrder("", []))).toThrow(/ID es obligatorio/);
    expect(dbOrders.getAll()).toHaveLength(0);
  });

  it("rechaza un ID duplicado y no descuenta stock dos veces", () => {
    const product = seedProduct();
    dbOrders.create(makeOrder("AV-9003", [makeItem(product.id, 1)]));

    expect(() => dbOrders.create(makeOrder("AV-9003", [makeItem(product.id, 1)]))).toThrow(
      /ya existe un pedido/
    );

    const updated = dbProducts.getById(product.id);
    expect(updated?.stock).toBe(9); // una sola reserva
    expect(dbOrders.getAll()).toHaveLength(1);
  });

  it("no toca el inventario cuando stockReserved es false (importación histórica)", () => {
    const product = seedProduct();
    const imported = { ...makeOrder("AV-9004", [makeItem(product.id, 2)]), stockReserved: false };

    dbOrders.create(imported);

    const updated = dbProducts.getById(product.id);
    expect(updated?.stock).toBe(10);
    expect(updated?.soldCount).toBe(5);
    expect(dbOrders.getById("AV-9004")?.stockReserved).toBe(false);
  });

  it("omite productos que ya no existen sin romper la creación", () => {
    seedProduct();

    dbOrders.create(makeOrder("AV-9005", [makeItem("producto-dado-de-baja", 2)]));

    expect(dbOrders.getById("AV-9005")?.stockReserved).toBe(true);
    expect(dbOrders.getAll()).toHaveLength(1);
  });
});

describe("dbOrders.updateStatus — máquina de estados en la capa de datos", () => {
  it("aplica una transición válida y agrega el evento al historial", () => {
    dbOrders.create(makeOrder("AV-9101", []));

    const ok = dbOrders.updateStatus("AV-9101", "confirmado");

    expect(ok).toBe(true);
    const order = dbOrders.getById("AV-9101");
    expect(order?.status).toBe("confirmado");
    expect(order?.statusHistory).toHaveLength(2);
    expect(order?.statusHistory[1]).toMatchObject({ status: "confirmado" });
  });

  it("rechaza una transición inválida sin persistir nada", () => {
    dbOrders.create(makeOrder("AV-9102", []));

    const ok = dbOrders.updateStatus("AV-9102", "entregado");

    expect(ok).toBe(false);
    const order = dbOrders.getById("AV-9102");
    expect(order?.status).toBe("no-concretado");
    expect(order?.statusHistory).toHaveLength(1);
  });

  it("no reabre los estados terminales", () => {
    dbOrders.create(makeOrder("AV-9103", []));
    dbOrders.updateStatus("AV-9103", "confirmado");
    dbOrders.updateStatus("AV-9103", "enviado");
    dbOrders.updateStatus("AV-9103", "entregado");

    expect(dbOrders.updateStatus("AV-9103", "cancelado")).toBe(false);
    expect(dbOrders.updateStatus("AV-9103", "no-concretado")).toBe(false);
    expect(dbOrders.getById("AV-9103")?.status).toBe("entregado");
  });

  it("devuelve false para un pedido inexistente", () => {
    expect(dbOrders.updateStatus("AV-9999", "confirmado")).toBe(false);
  });
});

describe("dbOrders.updateStatus — liberación de stock al cancelar", () => {
  it("cancelar devuelve las unidades y descuenta las ventas (una sola vez)", () => {
    const product = seedProduct();
    dbOrders.create(makeOrder("AV-9201", [makeItem(product.id, 2)]));
    expect(dbProducts.getById(product.id)?.stock).toBe(8);

    expect(dbOrders.updateStatus("AV-9201", "cancelado")).toBe(true);

    const restored = dbProducts.getById(product.id);
    expect(restored?.stock).toBe(10);
    expect(restored?.soldCount).toBe(5);
    expect(dbOrders.getById("AV-9201")?.stockReserved).toBe(false);

    // "cancelado" es terminal: cualquier intento posterior queda rechazado
    // y el inventario no vuelve a moverse.
    expect(dbOrders.updateStatus("AV-9201", "confirmado")).toBe(false);
    expect(dbProducts.getById(product.id)?.stock).toBe(10);
    expect(dbProducts.getById(product.id)?.soldCount).toBe(5);
  });

  it("cancelar un pedido antiguo sin reserva no toca el inventario", () => {
    const product = seedProduct();
    const legacy = { ...makeOrder("AV-9202", [makeItem(product.id, 2)]), stockReserved: false };
    dbOrders.create(legacy);

    expect(dbOrders.updateStatus("AV-9202", "cancelado")).toBe(true);

    const updated = dbProducts.getById(product.id);
    expect(updated?.stock).toBe(10); // nunca se reservó → no se libera nada
    expect(updated?.soldCount).toBe(5);
  });
});

describe("dbOrders.generateOrderNumber", () => {
  it("evita colisiones con IDs ya existentes", () => {
    // Semilla: queda "AV-1049" usado y longitud 1 (1048 + 1 = 1049 → colisión).
    dbOrders.create(makeOrder("AV-1049", []));

    expect(dbOrders.generateOrderNumber()).toBe("AV-1050");
  });

  it("genera el siguiente número cuando no hay colisión", () => {
    expect(dbOrders.generateOrderNumber()).toBe("AV-1048");
  });
});
