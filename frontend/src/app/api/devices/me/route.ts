import { NextResponse } from "next/server";
import { fetchOwnedDeviceById } from "@/lib/orchestrator-db";
import { getSessionWalletFromRequest } from "@/lib/auth-session";

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const deviceId = url.searchParams.get("deviceId")?.trim();
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId query parameter required" }, { status: 400 });
    }
    const device = await fetchOwnedDeviceById(wallet, deviceId);
    if (!device) return NextResponse.json({ error: "Device not found" }, { status: 404 });
    return NextResponse.json({ device });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
