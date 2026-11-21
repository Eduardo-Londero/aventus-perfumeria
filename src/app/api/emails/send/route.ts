import { NextRequest, NextResponse } from "next/server";
import { hasEmailConfig, sendEmail } from "@/lib/server/emailService";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";

export async function POST(req: NextRequest) {
  // Solo administradores (o llamadas internas con secreto) pueden enviar emails.
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const session = await verifyAdminSession(token);
  const internalSecret = req.headers.get("x-internal-secret");
  const isInternal =
    !!process.env.EMAIL_INTERNAL_SECRET &&
    internalSecret === process.env.EMAIL_INTERNAL_SECRET;

  if (!session && !isInternal) {
    return NextResponse.json({ ok: false, message: "No autorizado." }, { status: 401 });
  }

  if (!hasEmailConfig()) {
    return NextResponse.json(
      { ok: false, message: "Email no configurado (falta RESEND_API_KEY)." },
      { status: 503 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const to = body?.to;
  const subject = String(body?.subject ?? "").trim();
  if (!to || !subject) {
    return NextResponse.json({ ok: false, message: "Faltan 'to' y/o 'subject'." }, { status: 400 });
  }

  const result = await sendEmail({
    to,
    subject,
    html: body?.html,
    text: body?.text,
    replyTo: body?.replyTo,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}