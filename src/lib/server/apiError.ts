/**
 * Errores de las rutas /api/data/* (Fase C-2)
 * ============================================
 * Módulo PURO (sin `next/server`) para que el servicio de escritura pueda
 * testearse en aislamiento. Cada error lleva `code` + `status` para que la
 * ruta devuelva JSON coherente y el cliente (src/lib/dataSync.ts) muestre el
 * mensaje tal cual al administrador.
 *
 * Mensajes en español rioplatense, accionables: quien administra la tienda
 * tiene que saber qué hacer, no leer un stack trace.
 */

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "BACKEND_NOT_ACTIVE"
  | "INVALID_ENTITY"
  | "INVALID_BODY"
  | "VALIDATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "CONFIG"
  | "INTERNAL";

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

/** 400: el cuerpo no pasa la validación del dominio. */
export class ValidationError extends ApiError {
  constructor(message: string) {
    super("VALIDATION", 400, message);
    this.name = "ValidationError";
  }
}

/** 400: el cuerpo ni siquiera es un JSON/objeto utilizable. */
export class InvalidBodyError extends ApiError {
  constructor(message = "Cuerpo de la petición inválido.") {
    super("INVALID_BODY", 400, message);
    this.name = "InvalidBodyError";
  }
}

/** 404: el id no existe en la tabla. */
export class NotFoundError extends ApiError {
  constructor(message: string) {
    super("NOT_FOUND", 404, message);
    this.name = "NotFoundError";
  }
}

/** 404: la entidad del path no está en la lista blanca. */
export class InvalidEntityError extends ApiError {
  constructor(message: string) {
    super("INVALID_ENTITY", 404, message);
    this.name = "InvalidEntityError";
  }
}

/** 409: conflicto de integridad (referencias, pedidos asociados, duplicados). */
export class ConflictError extends ApiError {
  constructor(message: string) {
    super("CONFLICT", 409, message);
    this.name = "ConflictError";
  }
}

/** 401: sin sesión de administrador válida. */
export class UnauthorizedError extends ApiError {
  constructor(message = "Sesión de administrador inválida o vencida.") {
    super("UNAUTHORIZED", 401, message);
    this.name = "UnauthorizedError";
  }
}

/** 503: falta configuración de servidor (service_role / URL). */
export class ConfigError extends ApiError {
  constructor(message: string) {
    super("CONFIG", 503, message);
    this.name = "ConfigError";
  }
}

/** 409: la ruta existe pero el build corre con el backend local. */
export class BackendNotActiveError extends ApiError {
  constructor() {
    super(
      "BACKEND_NOT_ACTIVE",
      409,
      "Este endpoint solo escribe cuando NEXT_PUBLIC_DATA_BACKEND=supabase. " +
        "El build actual corre con localStorage (corte único de escrituras)."
    );
    this.name = "BackendNotActiveError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// ---------------------------------------------------------------------------
// Errores de PostgREST / Postgres → errores de la API
// ---------------------------------------------------------------------------

/** Forma mínima del `error` que devuelve supabase-js. */
export interface PostgrestErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export interface PgErrorContext {
  /** Entidad en curso ("products"…), para mensajes con contexto. */
  entity: string;
  /** Acción en curso ("create" | "update" | "delete"). */
  action: "create" | "update" | "delete";
}

/**
 * Traduce un error de Postgres/PostREST a un error de la API.
 *
 * Los casos que más importan:
 *  - 23503 (FK): el registro referenciado no existe o está en uso → 409 con
 *    instrucción concreta (crear la marca/género, desactivar productos…).
 *  - 23505 (unique): slug o id duplicado → 409.
 *  - 23514/23502 (check / not null): valor fuera de lo permitido → 400.
 * Cualquier otra cosa queda como 500 con el mensaje original recortado (sin
 * filtrar detalles internos largos a la respuesta).
 */
export function mapPostgrestError(
  error: PostgrestErrorLike | null | undefined,
  context: PgErrorContext
): ApiError {
  const raw = (error?.message ?? "").trim();
  const code = (error?.code ?? "").trim();
  const detail = raw || "error sin detalle";

  if (code === "23503") {
    if (context.entity === "products") {
      return new ConflictError(
        context.action === "delete"
          ? "No se puede eliminar el producto: otra fila lo referencia."
          : "La marca o el género indicado no existe. Crealos en Marcas/Géneros antes de guardar el producto."
      );
    }
    if (context.action === "delete") {
      return new ConflictError(
        `No se puede eliminar: registros dependientes la están usando. ` +
          `Desactivalos o cambialos de ${context.entity === "brands" ? "marca" : "género"} primero.`
      );
    }
    return new ConflictError(
      `Referencia inexistente en "${context.entity}": ${detail}`
    );
  }

  if (code === "23505") {
    return new ConflictError(
      `Ya existe un registro con ese identificador o slug en "${context.entity}". ` +
        `Elegí otro nombre/ID.`
    );
  }

  if (code === "23514" || code === "23502") {
    return new ValidationError(
      `Valor no permitido en "${context.entity}": ${detail}`
    );
  }

  if (code === "42501") {
    return new ApiError(
      "INTERNAL",
      500,
      "Supabase rechazó la escritura por privilegios: revisá que la ruta " +
        "use SUPABASE_SERVICE_ROLE_KEY (solo servidor)."
    );
  }

  return new ApiError("INTERNAL", 500, `Fallo de base de datos: ${detail}`.slice(0, 400));
}
