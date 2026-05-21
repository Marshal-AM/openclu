import { getSupabaseAdmin } from "@/lib/supabase";

/** Read devices.orchestrator_url from Supabase (no cookie side effects). */
export async function fetchOrchestratorUrlFromDb(wallet: string): Promise<string | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("devices")
    .select("orchestrator_url")
    .eq("wallet_address", wallet.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const raw = data?.orchestrator_url?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}
