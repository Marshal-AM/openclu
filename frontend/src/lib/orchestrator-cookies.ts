import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "wallet_session";
export const ORCHESTRATOR_COOKIE = "orchestrator_url";

export const ORCHESTRATOR_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export function applyOrchestratorCookie(res: NextResponse, url: string | null): void {
  if (url) {
    res.cookies.set(ORCHESTRATOR_COOKIE, url, ORCHESTRATOR_COOKIE_OPTS);
  } else {
    res.cookies.delete(ORCHESTRATOR_COOKIE);
  }
}
