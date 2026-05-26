import { NextResponse } from "next/server";
import { getSessionWallet } from "@/lib/session";
import {
  deletePendingRegistration,
  getPendingRegistration,
  upsertPortalDevice,
} from "@/lib/portal-db";

export async function POST(req: Request) {
  try {
    const ownerWallet = await getSessionWallet();
    if (!ownerWallet) {
      return NextResponse.json(
        { error: "Please log in first to register this device." },
        { status: 401 },
      );
    }

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

    const { pending } = await getPendingRegistration(token);

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

    await upsertPortalDevice({
      deviceId: resolvedDeviceId!,
      deviceName: resolvedDeviceName!,
      deviceWallet: wallet,
      ownerWallet,
      registrationToken: token,
      registeredAt: new Date().toISOString(),
      orchestratorUrl: orchestrator_url,
    });

    if (pending) {
      await deletePendingRegistration(token);
    }

    return NextResponse.json({
      ok: true,
      wallet_address: wallet,
      owner_wallet_address: ownerWallet,
      orchestrator_url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
