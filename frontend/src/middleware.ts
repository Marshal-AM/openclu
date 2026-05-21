import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchOrchestratorUrlFromDb } from "@/lib/orchestrator-db";
import { applyOrchestratorCookie, SESSION_COOKIE } from "@/lib/orchestrator-cookies";

const PUBLIC = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/devices/register",
  "/api/devices/pending",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE)?.value?.toLowerCase();
  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const res = NextResponse.next();

  if (session) {
    try {
      const url = await fetchOrchestratorUrlFromDb(session);
      applyOrchestratorCookie(res, url);
    } catch {
      // Do not block navigation if Supabase is temporarily unavailable
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
