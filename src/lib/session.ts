/**
 * Sesión de administrador firmada (HMAC-SHA256)
 * ==============================================
 * Este módulo es EXCLUSIVO del servidor: lo consumen los Route Handlers de
 * /api/auth/* y src/middleware.ts. No debe importarse desde componentes cliente.
 *
 * Diseño:
 *  - El secreto vive en ADMIN_SESSION_SECRET (o ADMIN_PASSWORD como respaldo)
 *    y jamás se inyecta en el bundle del navegador.
 *  - El token es `payloadEnBase64Url.firmaEnBase64Url`.
 *  - La verificación es estricta: firma válida + expiración + rol "admin".
 *  - Si no hay secreto configurado, NO se emiten ni se aceptan sesiones
 *    (fail closed): el panel queda inaccesible hasta configurar el secreto.
 */

export const ADMIN_SESSION_COOKIE = "aventus_admin_session";

/** Duración de la sesión de administrador: 8 horas. */
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface AdminSessionPayload {
  /** Subject: identificador del administrador. */
  sub: string;
  role: "admin";
  /** Expiración en epoch seconds (UTC). */
  exp: number;
}

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeText(text: string): string {
  return bytesToBase64Url(encoder.encode(text));
}

function base64UrlDecodeText(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

/**
 * Secreto de firma. Devuelve `null` en el navegador o cuando falta configurarlo.
 */
export function getAdminSessionSecret(): string | null {
  if (typeof window !== "undefined") return null;
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  // mínimo 8 caracteres: evita firmas con secretos triviales
  return secret && secret.length >= 8 ? secret : null;
}

async function getSubtle(): Promise<SubtleCrypto> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("WebCrypto no disponible: no se puede firmar la sesión");
  }
  return subtle;
}

async function hmacSha256Base64Url(secret: string, message: string): Promise<string> {
  const subtle = await getSubtle();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await subtle.sign("HMAC", key, encoder.encode(message));
  return bytesToBase64Url(new Uint8Array(signature));
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const subtle = await getSubtle();
  const digest = await subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(digest);
}

/**
 * Comparación de cadenas en tiempo constante (no filtra longitud ni posición
 * del primer byte distinto). Se compara el hash SHA-256 de ambos valores para
 * que el largo de la entrada no sea observable.
 */
export async function secureEquals(a: string, b: string): Promise<boolean> {
  const [hashA, hashB] = await Promise.all([sha256Bytes(a), sha256Bytes(b)]);
  if (hashA.length !== hashB.length) return false;
  let diff = 0;
  for (let i = 0; i < hashA.length; i += 1) {
    diff |= hashA[i] ^ hashB[i];
  }
  return diff === 0;
}

/** Firma un token de sesión de administrador. */
export async function signAdminSession(
  payload: Omit<AdminSessionPayload, "role"> & { role?: "admin" }
): Promise<string | null> {
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const body: AdminSessionPayload = {
    sub: payload.sub,
    role: "admin",
    exp: payload.exp,
  };
  const encoded = base64UrlEncodeText(JSON.stringify(body));
  const signature = await hmacSha256Base64Url(secret, encoded);
  return `${encoded}.${signature}`;
}

/**
 * Verifica un token de sesión. Devuelve el payload solo si la firma es válida,
 * no está vencido y el rol es "admin". Cualquier anomalía devuelve `null`.
 */
export async function verifyAdminSession(token: string | null | undefined): Promise<AdminSessionPayload | null> {
  if (!token) return null;
  const secret = getAdminSessionSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  if (!encoded || !signature) return null;

  const expected = await hmacSha256Base64Url(secret, encoded);
  // comparación en tiempo constante de las firmas (sin lanzar excepciones
  // ante entradas malformadas)
  const signaturesMatch = await secureEquals(signature, expected);
  if (!signaturesMatch) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(base64UrlDecodeText(encoded));
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const candidate = parsed as Partial<AdminSessionPayload>;
  if (candidate.role !== "admin") return null;
  if (typeof candidate.sub !== "string" || !candidate.sub) return null;
  if (typeof candidate.exp !== "number" || !Number.isFinite(candidate.exp)) return null;
  if (candidate.exp * 1000 <= Date.now()) return null;

  return { sub: candidate.sub, role: "admin", exp: candidate.exp };
}

/** Opciones de cookie compartidas por el emisor (Route Handler) y el limpiador. */
export function adminSessionCookieOptions(secure: boolean, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    secure,
  };
}
