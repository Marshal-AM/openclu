import { NextResponse } from "next/server";
import { ORCHESTRATOR_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(ORCHESTRATOR_COOKIE);
  return res;
}
