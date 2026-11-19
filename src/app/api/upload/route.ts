import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/server/adminGuard";
import { rateLimit, getClientIp } from "@/lib/server/rateLimit";
import { getSupabaseAdmin } from "@/lib/server/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — subida de imágenes del panel de administración
 * =================================================================
 * Recibe un archivo (multipart/form-data, campo "file"), lo OPTIMIZA en el
 * servidor y lo sube a **Supabase Storage** (bucket `imagenes`), devolviendo
 * la URL pública. La base de datos solo guarda la URL (texto), nunca los
 * bytes de la foto: por eso 40.000 imágenes no pesan en la DB.
 *
 * Optimización aplicada:
 *  - se redimensiona al ancho máximo indicado (sin ampliar);
 *  - si se pasa `aspectRatio` ("W:H", ej. "3:4"), la imagen se RECORTA al
 *    centro a esa proporción ANTES de redimensionar, para que el resultado
 *    encaje en los contenedores `object-cover` sin cortar el producto;
 *  - se convierte a AVIF (calidad 80) con fallback a WebP (calidad 80),
 *    sin metadatos/EXIF. Calidad 80 evita que la foto se vea "medio mal"
 *    tras la optimización (antes era 50);
 *  - se descartan los canales alfa si el fondo no los necesita.
 *
 * Seguridad: requiere sesión de admin firmada (cookie httpOnly). Tamaño
 * máximo 10 MB. Solo se aceptan tipos MIME de imagen.
 *
 * Despliegue: Storage es externo, así que funciona igual en `next dev`,
 * servidores propios y entornos serverless (Vercel) — ahí el filesystem es
 * de solo lectura y este endpoint ya no lo usa. El bucket se crea solo en
 * el primer uso (idempotente).
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_WIDTH = 1200;      // ancho máximo de salida si no se indica (px)
const MIN_MAX_WIDTH = 320;
const ABSOLUTE_MAX_WIDTH = 2000;

/** Bucket público de imágenes del panel (se crea automáticamente). */
const BUCKET = "imagenes";

/**
 * Garantiza que el bucket exista (público, límite 10 MB). Idempotente: si ya
 * existe o hay error transitorio, se ignora y la subida real informa cualquier
 * problema concreto.
 */
async function ensureBucket(): Promise<void> {
  try {
    const admin = getSupabaseAdmin();
    const { data } = await admin.storage.getBucket(BUCKET);
    if (data) return;
    await admin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: String(MAX_BYTES),
      allowedMimeTypes: [...ALLOWED_TYPES],
    });
  } catch {
    // Bucket ya creado por otra instancia u otra sesión: lo decide la subida.
  }
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

function sanitizeBaseName(name: string): string {
  const withoutExt = name.replace(/\.[^.]+$/, "");
  const ascii = withoutExt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return ascii || "imagen";
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const rl = rateLimit(`upload:${getClientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, code: "RATE_LIMITED", message: "Demasiadas subidas. Esperá un momento." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Formulario inválido." },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_BODY", message: "Falta el archivo." },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "La imagen supera los 10 MB." },
      { status: 400 }
    );
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "Formato no soportado: usá JPG, PNG o WebP." },
      { status: 400 }
    );
  }

  const input = Buffer.from(await file.arrayBuffer());

  // Ancho máximo pedido por el formulario (cada lugar del admin indica el suyo).
  const rawMaxWidth = form.get("maxWidth");
  const requestedWidth =
    rawMaxWidth === null || rawMaxWidth === "" ? Number.NaN : Number(rawMaxWidth);
  const maxWidth = Number.isFinite(requestedWidth)
    ? Math.min(Math.max(Math.round(requestedWidth), MIN_MAX_WIDTH), ABSOLUTE_MAX_WIDTH)
    : DEFAULT_MAX_WIDTH;

  // Relación de aspecto recomendada (ej. "3:4" para fotos de producto). Si se
  // indica, la imagen se RECORTA al centro a esa proporción ANTES de
  // redimensionar, para que el resultado encaje en los contenedores
  // object-cover sin cortar el producto a la mitad.
  const rawAspect = form.get("aspectRatio");
  const aspectRatio =
    typeof rawAspect === "string" && /^\d+:\d+$/.test(rawAspect.trim())
      ? rawAspect.trim()
      : null;

  // Metadatos ORIENTADOS (respeta EXIF) para calcular el recorte correctamente.
  let metaWidth = 0;
  let metaHeight = 0;
  try {
    const m = await sharp(input, { failOn: "none" }).rotate().metadata();
    metaWidth = m.width ?? 0;
    metaHeight = m.height ?? 0;
  } catch {
    // Si no se pueden leer los metadatos, se sigue sin recorte (degradación).
  }

  // ¿Se va a recortar? (solo informativo, para que el cliente pueda avisar).
  let cropped = false;
  if (aspectRatio && metaWidth > 0 && metaHeight > 0) {
    const [rw, rh] = aspectRatio.split(":").map(Number);
    const target = rw / rh;
    const src = metaWidth / metaHeight;
    cropped = Math.abs(src - target) > 0.02;
  }

  // Pipeline base: rotación + recorte opcional al aspecto pedido + resize.
  function basePipeline() {
    let p = sharp(input, { failOn: "none" }).rotate();
    if (aspectRatio && metaWidth > 0 && metaHeight > 0) {
      const [rw, rh] = aspectRatio.split(":").map(Number);
      const target = rw / rh;
      const src = metaWidth / metaHeight;
      if (Math.abs(src - target) > 0.02) {
        let cropW: number;
        let cropH: number;
        if (src > target) {
          cropH = metaHeight;
          cropW = Math.max(1, Math.round(metaHeight * target));
        } else {
          cropW = metaWidth;
          cropH = Math.max(1, Math.round(metaWidth / target));
        }
        const left = Math.max(0, Math.round((metaWidth - cropW) / 2));
        const top = Math.max(0, Math.round((metaHeight - cropH) / 2));
        p = p.extract({ left, top, width: cropW, height: cropH });
      }
    }
    return p.resize({ width: maxWidth, withoutEnlargement: true });
  }

  // Optimización: AVIF (calidad 80) con fallback a WebP (calidad 80).
  let output: Buffer;
  let width: number;
  let height: number;
  let contentType = "image/webp";
  let ext = "webp";
  try {
    try {
      const processed = await basePipeline()
        .avif({ quality: 80, effort: 9 })
        .toBuffer({ resolveWithObject: true });
      output = processed.data;
      width = processed.info.width;
      height = processed.info.height;
      contentType = "image/avif";
      ext = "avif";
    } catch {
      const processed = await basePipeline()
        .webp({ quality: 80, effort: 6 })
        .toBuffer({ resolveWithObject: true });
      output = processed.data;
      width = processed.info.width;
      height = processed.info.height;
      contentType = "image/webp";
      ext = "webp";
    }
  } catch {
    return NextResponse.json(
      { ok: false, code: "VALIDATION", message: "No se pudo procesar la imagen." },
      { status: 400 }
    );
  }

  // Nombre único y legible en el bucket (se conserva la sanitización).
  const base = sanitizeBaseName(file.name);
  const unique = `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${unique}.${ext}`;

  await ensureBucket();

  const admin = getSupabaseAdmin();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(filename, output, {
      contentType,
      upsert: false,
    });

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "UPLOAD_FAILED",
        message: `No se pudo guardar la imagen en Storage: ${error.message}`,
      },
      { status: 502 }
    );
  }

  const { data: { publicUrl } } = admin.storage.from(BUCKET).getPublicUrl(filename);

  return NextResponse.json({
    ok: true,
    url: publicUrl,
    thumbnailUrl: publicUrl,
    bytes: output.length,
    width,
    height,
    cropped,
  });
}
