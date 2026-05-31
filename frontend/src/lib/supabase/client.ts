import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

let admin: SupabaseClient | null = null;

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export function getSupabase(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new SupabaseConfigError(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

export function normalizeWalletAddress(value: string): string {
  const w = value.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(w)) {
    throw new Error(`Invalid wallet address: ${value}`);
  }
  return w;
}
