import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  ORCHESTRATOR_COOKIE,
  ORCHESTRATOR_COOKIE_OPTS,
  SESSION_COOKIE,
} from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { address } = (await req.json()) as { address?: string };
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Valid 0x wallet address required" }, { status: 400 });
    }
    const normalized = address.toLowerCase();
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("devices")
      .select("id, wallet_address, registered_at, orchestrator_url")
      .eq("wallet_address", normalized)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.registered_at) {
      return NextResponse.json(
        { error: "Device not registered. Complete registration from register.sh QR link." },
        { status: 403 },
      );
    }
    const orchUrl = data.orchestrator_url?.replace(/\/$/, "") ?? null;
    if (!orchUrl) {
      return NextResponse.json(
        {
          error:
            "Device has no orchestrator_url. Re-run register.sh with orchestrator + ngrok, then register again.",
        },
        { status: 403 },
      );
    }
    const res = NextResponse.json({ ok: true, address: normalized, orchestratorUrl: orchUrl });
    res.cookies.set(SESSION_COOKIE, normalized, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    res.cookies.set(ORCHESTRATOR_COOKIE, orchUrl, ORCHESTRATOR_COOKIE_OPTS);
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
