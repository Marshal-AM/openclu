import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { getSupabaseAdmin } from "@/lib/supabase";

async function resolveOwnedDeviceId(
  sb: ReturnType<typeof getSupabaseAdmin>,
  wallet: string,
  deviceId: string | null,
): Promise<{ ok: true; deviceId: string } | { ok: false; error: string; status: number }> {
  if (!deviceId) {
    return { ok: false, error: "deviceId required for contribution operations", status: 400 };
  }
  const { data: device, error: dErr } = await sb
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("owner_wallet_address", wallet)
    .maybeSingle();
  if (dErr) return { ok: false, error: dErr.message, status: 500 };
  if (!device) return { ok: false, error: "Device not found for this owner", status: 404 };
  return { ok: true, deviceId: device.id };
}

type ContributionRow = Record<string, unknown> & {
  devices?: { id: string; device_name: string; device_id: string } | null;
};

function mapContributionRow(row: ContributionRow) {
  const { devices, ...rest } = row;
  return {
    ...rest,
    device_name: devices?.device_name ?? null,
  };
}

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const deviceId = new URL(req.url).searchParams.get("deviceId")?.trim() ?? null;

    const sb = getSupabaseAdmin();

    if (deviceId) {
      const resolved = await resolveOwnedDeviceId(sb, wallet, deviceId);
      if (!resolved.ok) {
        return NextResponse.json({ error: resolved.error }, { status: resolved.status });
      }

      const { data, error } = await sb
        .from("skill_contributions")
        .select("*, devices!inner(id, device_name, device_id)")
        .eq("device_id", resolved.deviceId)
        .order("updated_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        contributions: (data ?? []).map((row) => mapContributionRow(row as ContributionRow)),
      });
    }

    const { data, error } = await sb
      .from("skill_contributions")
      .select("*, devices!inner(id, device_name, device_id, owner_wallet_address)")
      .eq("devices.owner_wallet_address", wallet.toLowerCase())
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      contributions: (data ?? []).map((row) => mapContributionRow(row as ContributionRow)),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json()) as {
      deviceId?: string;
      skillSlug?: string;
      status?: string;
      jobId?: string;
      arkivListingKey?: string;
      arkivVersion?: number;
      errorMessage?: string;
      title?: string;
      description?: string;
      metadata?: { title?: string; description?: string };
    };
    const sb = getSupabaseAdmin();
    const resolved = await resolveOwnedDeviceId(sb, wallet, body.deviceId?.trim() ?? null);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    if (!body.skillSlug?.trim()) {
      return NextResponse.json({ error: "skillSlug required" }, { status: 400 });
    }

    const meta = body.metadata;
    const row: Record<string, unknown> = {
      device_id: resolved.deviceId,
      skill_slug: body.skillSlug.trim(),
      status: body.status ?? "draft",
      job_id: body.jobId,
      arkiv_listing_key: body.arkivListingKey,
      arkiv_version: body.arkivVersion,
      error_message: body.errorMessage,
      title: body.title ?? meta?.title,
      description: body.description ?? meta?.description,
    };
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
