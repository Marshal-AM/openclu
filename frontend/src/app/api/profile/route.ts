import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { getPortalUserProfile, upsertPortalUserProfile } from "@/lib/portal-db";

function normalizeOptionalText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function normalizeOptionalEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { profile } = await getPortalUserProfile(wallet);
    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as {
      displayName?: unknown;
      email?: unknown;
      bio?: unknown;
    };

    const update = {
      displayName: normalizeOptionalText(body.displayName, 80),
      email: normalizeOptionalEmail(body.email),
      bio: normalizeOptionalText(body.bio, 320),
    };

    if (typeof body.email === "string" && body.email.trim() && !update.email) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const { profile } = await upsertPortalUserProfile({
      walletAddress: wallet,
      ...update,
    });

    return NextResponse.json({ profile });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
