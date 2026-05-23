import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { fetchOwnedDeviceOrchestratorUrl } from "@/lib/session";

async function proxy(req: Request, pathSegs: string[]) {
  const ownerWallet = getSessionWalletFromRequest(req);
  if (!ownerWallet) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const deviceId = req.headers.get("x-device-id")?.trim();
  if (!deviceId) {
    return NextResponse.json(
      { error: "Missing x-device-id header for portal interaction." },
      { status: 400 },
    );
  }

  const resolved = await fetchOwnedDeviceOrchestratorUrl(ownerWallet, deviceId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const base = resolved.url;
  const path = pathSegs.join("/");
  const url = `${base}/api/v1/${path}${new URL(req.url).search}`;
  const init: RequestInit = {
    method: req.method,
    headers: { "Content-Type": "application/json" },
  };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.text();
  }
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: `Cannot reach device portal at ${base}. Is the portal running and ngrok tunnel active? ${msg}`,
      },
      { status: 502 },
    );
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxy(req, path);
}
