import { NextResponse } from "next/server";
import { getSessionWalletFromRequest } from "@/lib/auth-session";
import { getSupabaseAdmin } from "@/lib/supabase";

type UserProfileRow = {
  wallet_address: string;
  display_name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_login_at: string | null;
};

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

function toProfilePayload(row: UserProfileRow) {
  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    email: row.email,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

export async function GET(req: Request) {
  try {
    const wallet = getSessionWalletFromRequest(req);
    if (!wallet) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("users")
      .select("wallet_address, display_name, email, bio, avatar_url, created_at, updated_at, last_login_at")
      .eq("wallet_address", wallet)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!data) {
      const now = new Date().toISOString();
      const fallback: UserProfileRow = {
        wallet_address: wallet,
        display_name: null,
        email: null,
        bio: null,
        avatar_url: null,
        created_at: now,
        updated_at: now,
        last_login_at: now,
      };
      return NextResponse.json({ profile: toProfilePayload(fallback) });
    }

    return NextResponse.json({ profile: toProfilePayload(data as UserProfileRow) });
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
      display_name: normalizeOptionalText(body.displayName, 80),
      email: normalizeOptionalEmail(body.email),
      bio: normalizeOptionalText(body.bio, 320),
    };

    if (typeof body.email === "string" && body.email.trim() && !update.email) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("users")
      .upsert(
        {
          wallet_address: wallet,
          ...update,
        },
        { onConflict: "wallet_address" },
      )
      .select("wallet_address, display_name, email, bio, avatar_url, created_at, updated_at, last_login_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ profile: toProfilePayload(data as UserProfileRow) });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
