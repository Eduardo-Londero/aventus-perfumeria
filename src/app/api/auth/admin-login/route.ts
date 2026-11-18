import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_SECONDS,
  adminSessionCookieOptions,
  secureEquals,
  signAdminSession,
} from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/admin-login
 * ==========================
 * Único punto de entrada para la sesión de administrador.
 *
 * - Lee ADMIN_EMAIL / ADMIN_PASSWORD SOLO en el servidor (nunca llegan al
 *   bundle del navegador).
 * - Si las variables no están configuradas responde 503 y no emite cookie
 *   (fail closed): no existe ningún "admin123" de respaldo.
 * - Limita intentos por IP para dificultar fuerza bruta.
 */

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;

interface AttemptBucket {
  count: number;
  resetAt: number;
}

// Límite de intentos en memoria (se reinicia junto con el proceso).
const attemptsByIp = new Map<string, AttemptBucket>();

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = attemptsByIp.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    attemptsByIp.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > MAX_ATTEMPTS_PER_WINDOW;
}

function registerFailure(ip: string): void {
  const bucket = attemptsByIp.get(ip);
  if (bucket) bucket.count += 1;
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: "Demasiados intentos. Esperá un minuto y volvé a intentar.",
      },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Cuerpo de la petición inválido." },
      { status: 400 }
    );
  }

  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown };
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length === 0 ||
    email.length > 254 ||
    password.length === 0 ||
    password.length > 256
  ) {
    return NextResponse.json(
      { code: "INVALID_BODY", message: "Email y contraseña son requeridos." },
      { status: 400 }
    );
  }

  const configuredEmail = process.env.ADMIN_EMAIL;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  if (!configuredEmail || !configuredPassword) {
    // Sin credenciales configuradas no hay panel: se informa qué falta.
    return NextResponse.json(
      {
        code: "ADMIN_AUTH_UNCONFIGURED",
        message:
          "El panel de administración no está configurado. Definí ADMIN_EMAIL y ADMIN_PASSWORD en .env.local (o en las variables del entorno de despliegue) y volvé a intentar.",
      },
      { status: 503 }
    );
  }

  const emailMatches = await secureEquals(
    email.trim().toLowerCase(),
    configuredEmail.trim().toLowerCase()
  );
  const passwordMatches = await secureEquals(password, configuredPassword);

  if (!emailMatches || !passwordMatches) {
    registerFailure(ip);
    return NextResponse.json(
      { code: "INVALID_CREDENTIALS", message: "Email o contraseña incorrectos." },
      { status: 401 }
    );
  }

  const token = await signAdminSession({
    sub: configuredEmail.trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  });

  if (!token) {
    // No hay secreto de firma disponible en este entorno.
    return NextResponse.json(
      {
        code: "ADMIN_SESSION_SECRET_MISSING",
        message:
          "Falta ADMIN_SESSION_SECRET (o ADMIN_PASSWORD con al menos 8 caracteres) para firmar la sesión del panel.",
      },
      { status: 503 }
    );
  }

  const isSecure =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";

  const response = NextResponse.json({
    ok: true,
    role: "admin",
    user: {
      id: "admin-local",
      name: "Admin",
      lastName: "Aventus",
      email: configuredEmail.trim().toLowerCase(),
      phone: "",
      role: "admin",
      createdAt: new Date().toISOString(),
    },
  });

  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    token,
    adminSessionCookieOptions(isSecure, ADMIN_SESSION_TTL_SECONDS)
  );

  return response;
}
