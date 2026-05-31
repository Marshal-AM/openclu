import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS } from "@/lib/orchestrator-cookies";

function normalizedAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

/** Establish server session cookie only — no Catalog write (login must not require portal wallet gas). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = normalizedAddress(body.address);

  if (!address) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, address });
  res.cookies.set(SESSION_COOKIE, address, SESSION_COOKIE_OPTS);
  return res;
}
