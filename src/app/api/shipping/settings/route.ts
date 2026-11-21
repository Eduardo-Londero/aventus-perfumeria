import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession, ADMIN_SESSION_COOKIE } from "@/lib/session";
import { getShippingSettings, setShippingSetting, isShippingProviderEnabled } from "@/lib/server/shippingSettings";
import { getShippingProviderStatus } from "@/lib/shipping";

export async function GET() {
  try {
    const settings = await getShippingSettings();
    const status = getShippingProviderStatus();
    // Merge: configured (env) + enabled (db)
    const merged = status.map((s) => {
      const st = settings.find((x) => x.provider === s.id || x.provider === s.id.replace("_", ""));
      return {
        ...s,
        enabled: st ? st.enabled : true,
        updatedAt: st?.updatedAt ?? null,
        updatedBy: st?.updatedBy ?? null,
      };
    });
    return NextResponse.json({ ok: true, providers: merged });
  } catch (err) {
    // Si la tabla no existe, devolver solo status de env
    const status = getShippingProviderStatus();
    return NextResponse.json({
      ok: true,
      providers: status.map((s) => ({ ...s, enabled: true, updatedAt: null, updatedBy: null })),
      warning: err instanceof Error ? err.message : "No se pudieron leer settings",
    });
  }
}

export async function PATCH(req: NextRequest) {
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

  const provider = String(body?.provider ?? "").trim();
  const enabled = Boolean(body?.enabled);
  if (!provider) {
    return NextResponse.json({ ok: false, message: "Falta provider." }, { status: 400 });
  }

  try {
    await setShippingSetting(provider, enabled, session.sub || "admin");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Error actualizando." },
      { status: 500 }
    );
  }
}