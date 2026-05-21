import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { token, address, deviceName, deviceId, orchestratorUrl } =
      (await req.json()) as {
        token?: string;
        address?: string;
        deviceName?: string;
        deviceId?: string;
        orchestratorUrl?: string;
      };
    if (!token || !address) {
      return NextResponse.json({ error: "token and address required" }, { status: 400 });
    }
    const wallet = address.toLowerCase();
    const orchestrator_url = (orchestratorUrl ?? "").trim().replace(/\/$/, "");
    if (!orchestrator_url) {
      return NextResponse.json(
        { error: "orchestratorUrl required (from register.sh / ngrok)" },
        { status: 400 },
      );
    }

    const sb = getSupabaseAdmin();

    const { data: pending, error: pErr } = await sb
      .from("device_registration_pending")
      .select("*")
      .eq("registration_token", token)
      .maybeSingle();

    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    let resolvedDeviceId = deviceId?.trim();
    let resolvedDeviceName = deviceName?.trim();

    if (pending) {
      if (pending.wallet_address.toLowerCase() !== wallet) {
        return NextResponse.json({ error: "Address does not match registration" }, { status: 400 });
      }
      resolvedDeviceId = resolvedDeviceId ?? pending.device_id;
      resolvedDeviceName = resolvedDeviceName ?? pending.device_name;
      const orchFromPending = pending.orchestrator_url?.replace(/\/$/, "");
      if (orchFromPending && orchFromPending !== orchestrator_url) {
        return NextResponse.json(
          { error: "orchestratorUrl does not match pending registration" },
          { status: 400 },
        );
      }
    } else if (!resolvedDeviceId || !resolvedDeviceName) {
      return NextResponse.json(
        {
          error:
            "Invalid or expired token — run register.sh again, or include deviceId and deviceName in the link",
        },
        { status: 404 },
      );
    }

    const { error: insErr } = await sb.from("devices").upsert({
      device_id: resolvedDeviceId!,
      device_name: resolvedDeviceName!,
      wallet_address: wallet,
      registration_token: token,
      registered_at: new Date().toISOString(),
      owner_wallet_address: wallet,
      orchestrator_url,
    });
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    if (pending) {
      await sb.from("device_registration_pending").delete().eq("registration_token", token);
    }

    return NextResponse.json({ ok: true, wallet_address: wallet, orchestrator_url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
