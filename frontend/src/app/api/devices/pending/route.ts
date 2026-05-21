import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Called by register.sh on the device — stores pending row before user opens /register. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      registration_token?: string;
      device_id?: string;
      device_name?: string;
      wallet_address?: string;
      orchestrator_url?: string;
    };
    const { registration_token, device_id, device_name, wallet_address, orchestrator_url } =
      body;
    if (!registration_token || !device_id || !device_name || !wallet_address) {
      return NextResponse.json(
        { error: "registration_token, device_id, device_name, wallet_address required" },
        { status: 400 },
      );
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("device_registration_pending").upsert({
      registration_token,
      device_id,
      device_name,
      orchestrator_url: orchestrator_url?.replace(/\/$/, "") ?? null,
      wallet_address: wallet_address.toLowerCase(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
