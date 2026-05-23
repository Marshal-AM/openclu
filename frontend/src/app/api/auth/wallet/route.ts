import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS } from "@/lib/session";

function normalizedAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const address = normalizedAddress(body.address);

  if (!address) {
    return NextResponse.json({ error: "Valid wallet address required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("users").upsert(
    {
      wallet_address: address,
      last_login_at: new Date().toISOString(),
    },
    { onConflict: "wallet_address" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true, address });
  res.cookies.set(SESSION_COOKIE, address, SESSION_COOKIE_OPTS);
  return res;
}
