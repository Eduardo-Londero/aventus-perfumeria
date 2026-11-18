/**
 * Sincronización de escrituras del catálogo (Fase C-2)
 * ====================================================
 * Write-through OPTIMISTA: src/lib/db.ts aplica el cambio en memoria y lo
 * encola acá; esta cola lo manda, en orden, a /api/data/*.
 *
 * Por qué optimista: la interfaz de db.ts tiene que seguir siendo SÍNCRONA
 * (`create()`, `update()`, `delete()` no devuelven promesas). El costo de
 * esa decisión es que un rechazo del servidor se descubre después; por eso:
 *
 *   - cada operación lleva su `rollback` (restaura la fila anterior en
 *     memoria, sin pisar cambios de otras operaciones);
 *   - el fallo se registra (`getLastWriteError()`), se notifica por evento
 *     (`subscribeWriteFailure`) y la UI relee el estado real;
 *   - las escrituras se ejecutan en SERIE (cola) para que "crear y luego
 *     editar" llegue siempre en ese orden.
 *
 * Con `NEXT_PUBLIC_DATA_BACKEND=localStorage` (por defecto) no se encola nada:
 * sigue siendo un solo punto de corte de escrituras.
 */

import { IS_SUPABASE_BACKEND } from "@/lib/dataBackend";
import type { CatalogEntity } from "@/lib/catalogEntities";

export type WriteKind = "create" | "update" | "delete";

export interface WriteOp {
  entity: CatalogEntity;
  kind: WriteKind;
  id: string;
  /** Fila resultante para create/update (para delete no viaja cuerpo). */
  payload?: unknown;
}

export interface WriteFailure {
  entity: CatalogEntity;
  kind: WriteKind;
  id: string;
  /** Mensaje listo para mostrar (ya traducido por el servidor). */
  message: string;
  status?: number;
  code?: string;
}

type FailureListener = (failure: WriteFailure) => void;

let tail: Promise<void> = Promise.resolve();
let inFlight = 0;
let lastWriteError: string | null = null;
const listeners = new Set<FailureListener>();
let waiters: Array<() => void> = [];

/** Último mensaje de error de escritura (null si no hubo ninguno). */
export function getLastWriteError(): string | null {
  return lastWriteError;
}

/** Suscribe un listener de fallos. Devuelve la función de baja. */
export function subscribeWriteFailure(listener: FailureListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Resuelve cuando no quedan escrituras en vuelo. */
export function whenWritesSettled(): Promise<void> {
  if (inFlight === 0) return Promise.resolve();
  return new Promise<void>((resolve) => waiters.push(resolve));
}

/**
 * Encola una escritura. `rollback` se invoca SOLO si el servidor la rechaza
 * (o si no hay red): debe restaurar el estado previo de ESA fila.
 *
 * No lanza: la capa de datos es síncrona y el error queda disponible por
 * `getLastWriteError()` / `subscribeWriteFailure`.
 */
export function enqueueWrite(op: WriteOp, rollback: () => void): void {
  if (!IS_SUPABASE_BACKEND) return;

  inFlight += 1;
  tail = tail
    .then(() => perform(op))
    .then(
      () => settle(),
      (error: unknown) => {
        handleFailure(op, error, rollback);
        settle();
      }
    );
}

function settle(): void {
  inFlight = Math.max(0, inFlight - 1);
  if (inFlight === 0 && waiters.length > 0) {
    const pending = waiters;
    waiters = [];
    for (const resolve of pending) resolve();
  }
}

function handleFailure(op: WriteOp, error: unknown, rollback: () => void): void {
  const message = toMessage(error);
  const status =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status
      : undefined;
  const code =
    error && typeof error === "object" && "code" in error
      ? (error as { code?: string }).code
      : undefined;

  lastWriteError = message;

  try {
    rollback();
  } catch (rollbackError) {
    if (typeof console !== "undefined") {
      console.error("[dataSync] rollback falló:", rollbackError);
    }
  }

  const failure: WriteFailure = {
    entity: op.entity,
    kind: op.kind,
    id: op.id,
    message,
    status,
    code,
  };
  for (const listener of [...listeners]) {
    try {
      listener(failure);
    } catch (listenerError) {
      if (typeof console !== "undefined") {
        console.error("[dataSync] listener falló:", listenerError);
      }
    }
  }
}

function toMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return (
      "No se pudo conectar con el servidor para guardar el cambio. " +
      "Verificá tu conexión: la edición se revirtió."
    );
  }
  if (error instanceof Error && error.message.trim()) return error.message;
  return "No se pudo guardar el cambio en el servidor: la edición se revirtió.";
}

function endpointFor(op: WriteOp): string {
  if (op.kind === "create") return `/api/data/${op.entity}`;
  return `/api/data/${op.entity}/${encodeURIComponent(op.id)}`;
}

async function perform(op: WriteOp): Promise<void> {
  const init: RequestInit = {
    method:
      op.kind === "create" ? "POST" : op.kind === "update" ? "PATCH" : "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  };
  if (op.kind !== "delete") {
    init.body = JSON.stringify(op.payload ?? {});
  }

  let response: Response;
  try {
    response = await fetch(endpointFor(op), init);
  } catch (error) {
    // Red caída / DNS / abort: mismo tratamiento que un 5xx, con mensaje útil.
    if (typeof console !== "undefined") {
      console.error("[dataSync] fetch falló:", error);
    }
    throw new TypeError("fetch failed");
  }

  if (!response.ok) {
    let code: string | undefined;
    let message: string | undefined;
    try {
      const data = (await response.json()) as {
        code?: string;
        message?: string;
      };
      code = data.code;
      message = data.message;
    } catch {
      // Cuerpo no JSON (proxy/HTML): se informa el estado HTTP.
    }
    const failure = new Error(
      message?.trim() ||
        `El servidor rechazó la operación (HTTP ${response.status}).`
    );
    (failure as Error & { status?: number; code?: string }).status =
      response.status;
    (failure as Error & { status?: number; code?: string }).code = code;
    throw failure;
  }
}

/** Solo para tests: reinicia cola, contadores y suscriptores. */
export function resetDataSyncForTests(): void {
  tail = Promise.resolve();
  inFlight = 0;
  lastWriteError = null;
  listeners.clear();
  waiters = [];
}
