/**
 * Inventario — reserva y liberación de stock en operaciones de pedidos
 * ====================================================================
 * Funciones puras (sin acceso a localStorage ni al DOM) para que la lógica de
 * inventario sea testeable de forma independiente y quede centralizada:
 *
 *  - `reserveStock` se aplica UNA sola vez al crear un pedido: descuenta las
 *    unidades del catálogo y acumula las vendidas (`soldCount`).
 *  - `releaseStock` se aplica al cancelar un pedido que tenía reserva: devuelve
 *    las unidades al stock y descuenta las ventas acumuladas.
 *
 * Reglas:
 *  - El stock nunca queda negativo (se limita a 0).
 *  - `soldCount` nunca queda negativo (se limita a 0).
 *  - Cantidades no numéricas, cero o negativas, y líneas sin producto, se
 *    ignoran sin romper la operación.
 *  - Un producto inexistente se omite (si el producto se dio de baja entre la
 *    creación del pedido y su cancelación, esas unidades no se restauran; se
 *    documenta también en `src/lib/db.ts`).
 *  - No muta el arreglo de entrada: siempre devuelve uno nuevo.
 */

import type { Product } from "@/types";

export interface InventoryLine {
  productId: string;
  quantity: number;
}

export interface InventoryOutcome<T extends Product = Product> {
  /** Catálogo resultante (nueva referencia; no muta el arreglo recibido). */
  products: T[];
  /** IDs de productos realmente afectados. */
  updatedIds: string[];
}

/** Agrupa líneas repetidas del mismo producto y descarta cantidades inválidas. */
function normalizeLines(lines: readonly InventoryLine[]): InventoryLine[] {
  const merged = new Map<string, number>();

  for (const line of lines) {
    if (!line || typeof line.productId !== "string" || line.productId.trim().length === 0) {
      continue;
    }
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    merged.set(line.productId, (merged.get(line.productId) ?? 0) + quantity);
  }

  return [...merged].map(([productId, quantity]) => ({ productId, quantity }));
}

function applyInventory<T extends Product>(
  products: readonly T[],
  lines: readonly InventoryLine[],
  mode: "reserve" | "release"
): InventoryOutcome<T> {
  const next: T[] = [...products];
  const indexById = new Map<string, number>(next.map((p, index) => [p.id, index]));
  const updatedIds: string[] = [];

  for (const { productId, quantity } of normalizeLines(lines)) {
    const index = indexById.get(productId);
    if (index === undefined) continue;

    const current = next[index];
    const stock = Number.isFinite(current.stock) ? current.stock : 0;
    const sold = Number.isFinite(current.soldCount ?? 0) ? (current.soldCount ?? 0) : 0;

    const updated: T =
      mode === "reserve"
        ? { ...current, stock: Math.max(0, stock - quantity), soldCount: sold + quantity }
        : { ...current, stock: stock + quantity, soldCount: Math.max(0, sold - quantity) };

    next[index] = updated;
    updatedIds.push(productId);
  }

  return { products: next, updatedIds };
}

/**
 * Reserva stock para un pedido nuevo: descuenta unidades y suma ventas.
 * Nunca deja el stock en negativo.
 */
export function reserveStock<T extends Product>(
  products: readonly T[],
  lines: readonly InventoryLine[]
): InventoryOutcome<T> {
  return applyInventory(products, lines, "reserve");
}

/**
 * Libera una reserva (pedido cancelado): devuelve unidades y descuenta ventas,
 * sin dejar `soldCount` en negativo.
 */
export function releaseStock<T extends Product>(
  products: readonly T[],
  lines: readonly InventoryLine[]
): InventoryOutcome<T> {
  return applyInventory(products, lines, "release");
}
