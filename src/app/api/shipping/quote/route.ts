import { NextRequest, NextResponse } from "next/server";
import { getShippingQuotes } from "@/lib/shipping";

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

  const { quotes, results } = await getShippingQuotes(address, pkg);

  return NextResponse.json({ ok: true, quotes, results });
}