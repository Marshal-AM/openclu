import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, SESSION_COOKIE_OPTS } from "@/lib/orchestrator-cookies";

export { SESSION_COOKIE, SESSION_COOKIE_OPTS };

export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export async function getSessionWallet(): Promise<string | null> {
  const jar = await cookies();
  const wallet = jar.get(SESSION_COOKIE)?.value?.trim();
  return wallet ? normalizeAddress(wallet) : null;
}

export async function fetchOwnedDeviceOrchestratorUrl(
  ownerWallet: string,
  deviceId: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string; status: number }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("devices")
    .select("id, orchestrator_url")
    .eq("owner_wallet_address", normalizeAddress(ownerWallet))
    .eq("id", deviceId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) {
    return { ok: false, error: "Selected device not found for this owner.", status: 404 };
  }
  const orchestratorUrl = data.orchestrator_url?.trim().replace(/\/$/, "");
  if (!orchestratorUrl) {
    return {
      ok: false,
      error:
        "Selected device has no portal URL. Re-run register.sh/register.ps1 with ngrok, then re-register this device.",
      status: 403,
    };
  }
  return { ok: true, url: orchestratorUrl };
}
