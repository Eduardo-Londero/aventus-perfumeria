import { NextRequest, NextResponse } from "next/server";
import {
  errorResponse,
  requireAdmin,
  requireSupabaseBackend,
} from "@/lib/server/adminGuard";
import { fetchCustomers } from "@/lib/server/ordersService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const backend = requireSupabaseBackend();
  if (backend) return backend;

  const guard = await requireAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const customers = await fetchCustomers();
    return NextResponse.json({ ok: true, customers });
  } catch (error) {
    return errorResponse(error);
  }
}
