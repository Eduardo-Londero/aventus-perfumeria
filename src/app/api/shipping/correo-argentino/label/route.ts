import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { correoArgentinoProvider } from "@/lib/shipping/correoArgentino";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  if (!session) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const trackingNumber = String(body?.trackingNumber ?? "").trim();
  if (!trackingNumber) {
    return NextResponse.json({ ok: false, message: "Falta trackingNumber." }, { status: 400 });
  }

  if (!correoArgentinoProvider.isConfigured()) {
    return NextResponse.json({ ok: false, message: "Correo Argentino no configurado." }, { status: 503 });
  }

  const result = await correoArgentinoProvider.generateLabel!([trackingNumber], body?.format || "10x15");
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 500 });
  }

  const file = Array.isArray(result.files) ? result.files[0] : null;
  if (!file?.fileBase64) {
    return NextResponse.json({ ok: false, message: "No se pudo generar el rótulo." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    fileBase64: file.fileBase64,
    fileName: file.fileName || `${trackingNumber}.pdf`,
  });
}