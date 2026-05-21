import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionWallet } from "@/lib/session";

export async function GET() {
  try {
    const wallet = await getSessionWallet();
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const sb = getSupabaseAdmin();
    const { data: device, error: dErr } = await sb
      .from("devices")
      .select("id")
      .eq("wallet_address", wallet)
      .maybeSingle();
    if (dErr || !device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const { data, error } = await sb
      .from("skill_contributions")
      .select("*")
      .eq("device_id", device.id)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contributions: data ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const wallet = await getSessionWallet();
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const sb = getSupabaseAdmin();
    const { data: device } = await sb
      .from("devices")
      .select("id")
      .eq("wallet_address", wallet)
      .maybeSingle();
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });

    const meta = body.metadata as { title?: string; description?: string } | undefined;
    const row: Record<string, unknown> = {
      device_id: device.id,
      skill_slug: body.skillSlug,
      status: body.status ?? "draft",
      job_id: body.jobId,
      arkiv_listing_key: body.arkivListingKey,
      arkiv_version: body.arkivVersion,
      error_message: body.errorMessage,
      title: body.title ?? meta?.title,
      description: body.description ?? meta?.description,
    };
    // Live Supabase uses title/description columns (not metadata jsonb).
    const { data, error } = await sb
      .from("skill_contributions")
      .upsert(row, { onConflict: "device_id,skill_slug" })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ contribution: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
