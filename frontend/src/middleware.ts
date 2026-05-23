import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/orchestrator-cookies";

const PUBLIC = [
  "/login",
  "/register",
  "/api/auth/wallet",
  "/api/devices/register",
  "/api/devices/pending",
];
const PUBLIC_FILE = /\.(.*)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get(SESSION_COOKIE)?.value?.toLowerCase();

  if (pathname.startsWith("/login") && session) {
    return NextResponse.redirect(new URL("/contribute", req.url));
  }

  if (
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (!session && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
