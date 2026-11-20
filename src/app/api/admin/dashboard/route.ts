import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import {
  getKpis,
  getSalesSeries,
  getMonthly,
  getProductRanking,
  getPaymentMethods,
  getWeekday,
  getRecentActivity,
  getAlerts,
} from "@/lib/server/dashboardService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const url = new URL(req.url);
  const section = url.searchParams.get("section") || "kpis";
  const from = url.searchParams.get("from") || "";
  const to = url.searchParams.get("to") || "";

  try {
    switch (section) {
      case "kpis":
        return NextResponse.json({ ok: true, ...(await getKpis(from, to)) });
      case "series": {
        const granularity = (url.searchParams.get("granularity") as any) || "day";
        return NextResponse.json({ ok: true, data: await getSalesSeries(from, to, granularity) });
      }
      case "monthly": {
        const year = Number(url.searchParams.get("year") || new Date().getFullYear());
        return NextResponse.json({ ok: true, ...(await getMonthly(year)) });
      }
      case "products":
        return NextResponse.json({ ok: true, ...(await getProductRanking(from, to)) });
      case "payments":
        return NextResponse.json({ ok: true, data: await getPaymentMethods(from, to) });
      case "weekday":
        return NextResponse.json({ ok: true, data: await getWeekday(from, to) });
      case "activity":
        return NextResponse.json({ ok: true, data: await getRecentActivity(20) });
      case "alerts":
        return NextResponse.json({ ok: true, ...(await getAlerts()) });
      default:
        return NextResponse.json({ ok: false, code: "INVALID", message: "Sección desconocida." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
