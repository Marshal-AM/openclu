import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DbError } from "./errors.js";

let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new DbError(
      "CONFIG",
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export function normalizeWalletAddress(value: string): string {
  const w = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(w)) {
    throw new DbError("VALIDATION_FAILED", `Invalid wallet address: ${value}`);
  }
  return w;
}
