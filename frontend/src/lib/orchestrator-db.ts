import { getSupabaseAdmin } from "@/lib/supabase";

export type OwnedDevice = {
  id: string;
  device_id: string;
  device_name: string;
  wallet_address: string;
  owner_wallet_address: string;
  orchestrator_url: string | null;
  registered_at: string | null;
  created_at: string;
};

export async function listDevicesForOwner(wallet: string): Promise<OwnedDevice[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("devices")
    .select(
      "id, device_id, device_name, wallet_address, owner_wallet_address, orchestrator_url, registered_at, created_at",
    )
    .eq("owner_wallet_address", wallet.toLowerCase())
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as OwnedDevice[];
}

/** Read selected device row constrained to the current owner wallet. */
export async function fetchOwnedDeviceById(
  ownerWallet: string,
  deviceId: string,
): Promise<OwnedDevice | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("devices")
    .select(
      "id, device_id, device_name, wallet_address, owner_wallet_address, orchestrator_url, registered_at, created_at",
    )
    .eq("owner_wallet_address", ownerWallet.toLowerCase())
    .eq("id", deviceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OwnedDevice | null) ?? null;
}
