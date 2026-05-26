import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { updatePortalDevice } from "@/lib/portal-db";

function normalizeWallet(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const address = value.trim().toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(address) ? address : null;
}

function normalizeOptionalText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeOrchestratorUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\/$/, "");
  return trimmed || null;
}

function normalizeIsoTimestamp(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString();
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ portalId: string }> },
) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { portalId } = await context.params;
    if (!portalId?.trim()) {
      return NextResponse.json({ error: "Device id required" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      deviceId?: unknown;
      deviceName?: unknown;
      walletAddress?: unknown;
      orchestratorUrl?: unknown;
      registrationToken?: unknown;
      registeredAt?: unknown;
    };

    const deviceWallet = body.walletAddress !== undefined ? normalizeWallet(body.walletAddress) : undefined;
    if (body.walletAddress !== undefined && !deviceWallet) {
      return NextResponse.json({ error: "Invalid device wallet address" }, { status: 400 });
    }

    const orchestratorUrl = normalizeOrchestratorUrl(body.orchestratorUrl);
    if (body.orchestratorUrl !== undefined && orchestratorUrl === undefined) {
      return NextResponse.json({ error: "Invalid orchestrator URL" }, { status: 400 });
    }

    const registeredAt = normalizeIsoTimestamp(body.registeredAt);
    if (body.registeredAt !== undefined && registeredAt === undefined) {
      return NextResponse.json({ error: "Invalid registeredAt timestamp" }, { status: 400 });
    }

    const { device } = await updatePortalDevice({
      ownerWallet: wallet,
      portalId: portalId.trim(),
      deviceId: normalizeOptionalText(body.deviceId),
      deviceName: normalizeOptionalText(body.deviceName),
      deviceWallet: deviceWallet ?? undefined,
      orchestratorUrl,
      registrationToken:
        body.registrationToken === null
          ? null
          : normalizeOptionalText(body.registrationToken) ?? undefined,
      registeredAt,
    });

    return NextResponse.json({ device });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
