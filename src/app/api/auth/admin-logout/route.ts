import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

/** POST /api/auth/admin-logout — elimina la cookie httpOnly de administración. */
export async function POST(req: NextRequest) {
  const isSecure =
    req.headers.get("x-forwarded-proto") === "https" ||
    req.nextUrl.protocol === "https:";

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isSecure,
  });
  return response;
}
