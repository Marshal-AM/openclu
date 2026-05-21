import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionWallet } from "@/lib/session";

export async function GET() {
  try {
    const wallet = await getSessionWallet();
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("devices")
      .select("*")
      .eq("wallet_address", wallet)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    return NextResponse.json({ device: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
