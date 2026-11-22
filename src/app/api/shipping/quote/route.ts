import { NextRequest, NextResponse } from "next/server";
import { shippingProviders } from "@/lib/shipping";
import { isShippingProviderEnabled } from "@/lib/server/shippingSettings";

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Body inválido." }, { status: 400 });
  }

  const postalCode = String(body?.postalCode ?? "").trim();
  if (!postalCode) {
    return NextResponse.json({ ok: false, message: "Falta código postal." }, { status: 400 });
  }

  const address = {
    postalCode,
    city: body?.city ? String(body.city) : undefined,
    province: body?.province ? String(body.province) : undefined,
  };

  const pkg = {
    weightGrams: Number(body?.weightGrams) || 500,
    heightCm: Number(body?.heightCm) || 10,
    widthCm: Number(body?.widthCm) || 10,
    lengthCm: Number(body?.lengthCm) || 10,
  };

  // Filtrar por habilitado (DB) + configurado (env)
  const enabledResults = [];
  const enabledQuotes = [];
  for (const p of shippingProviders) {
    const enabled = await isShippingProviderEnabled(p.id);
    if (!enabled) {
      enabledResults.push({
        provider: p.id,
        configured: p.isConfigured(),
        ok: false,
        message: "Deshabilitado por el administrador.",
        quotes: [],
      });
      continue;
    }
    const r = await p.getQuotes(address, pkg);
    enabledResults.push(r);
    enabledQuotes.push(...r.quotes);
  }

  return NextResponse.json({ ok: true, quotes: enabledQuotes, results: enabledResults });
}