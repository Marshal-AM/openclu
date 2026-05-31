import { getSupabaseAdmin, normalizeWalletAddress } from "../client.js";
import { DbError } from "../errors.js";
import type {
  PendingRegistrationRow,
  PortalDeviceRow,
  PortalUserRow,
} from "../portal-types.js";

function toUserRow(row: {
  wallet_address: string;
  display_name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}): PortalUserRow {
  return {
    walletAddress: row.wallet_address,
    displayName: row.display_name,
    email: row.email,
    bio: row.bio,
    avatar: null,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
    entityKey: row.wallet_address,
  };
}

function toDeviceRow(row: {
  id: string;
  device_id: string;
  device_name: string;
  wallet_address: string;
  owner_wallet_address: string;
  registration_token: string | null;
  registered_at: string | null;
  orchestrator_url: string | null;
  created_at: string;
}): PortalDeviceRow {
  return {
    portalId: row.id,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceWallet: row.wallet_address,
    ownerWallet: row.owner_wallet_address,
    registrationToken: row.registration_token,
    registeredAt: row.registered_at,
    orchestratorUrl: row.orchestrator_url,
    createdAt: row.created_at,
    entityKey: row.id,
  };
}

function toPendingRow(row: {
  registration_token: string;
  device_id: string;
  device_name: string;
  wallet_address: string;
  orchestrator_url: string | null;
  created_at: string;
  expires_at: string;
}): PendingRegistrationRow {
  return {
    registrationToken: row.registration_token,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceWallet: row.wallet_address,
    orchestratorUrl: row.orchestrator_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    entityKey: row.registration_token,
  };
}

export async function fetchPortalUser(walletAddress: string): Promise<PortalUserRow | null> {
  const wallet = normalizeWalletAddress(walletAddress);
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("*")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw new DbError("DB_ERROR", error.message);
  return data ? toUserRow(data) : null;
}

export async function fetchPortalDevicesForOwner(ownerWallet: string): Promise<PortalDeviceRow[]> {
  const owner = normalizeWalletAddress(ownerWallet);
  const { data, error } = await getSupabaseAdmin()
    .from("devices")
    .select("*")
    .eq("owner_wallet_address", owner)
    .order("created_at", { ascending: false });
  if (error) throw new DbError("DB_ERROR", error.message);
  return (data ?? []).map(toDeviceRow);
}

export async function fetchPortalDeviceByPortalId(
  ownerWallet: string,
  portalId: string,
): Promise<PortalDeviceRow | null> {
  const owner = normalizeWalletAddress(ownerWallet);
  const { data, error } = await getSupabaseAdmin()
    .from("devices")
    .select("*")
    .eq("owner_wallet_address", owner)
    .eq("id", portalId)
    .maybeSingle();
  if (error) throw new DbError("DB_ERROR", error.message);
  return data ? toDeviceRow(data) : null;
}

export async function fetchPortalDeviceByDeviceWallet(
  deviceWallet: string,
): Promise<PortalDeviceRow | null> {
  const wallet = normalizeWalletAddress(deviceWallet);
  const { data, error } = await getSupabaseAdmin()
    .from("devices")
    .select("*")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw new DbError("DB_ERROR", error.message);
  return data ? toDeviceRow(data) : null;
}

export async function fetchPendingRegistrationByToken(
  registrationToken: string,
): Promise<PendingRegistrationRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("device_registration_pending")
    .select("*")
    .eq("registration_token", registrationToken)
    .maybeSingle();
  if (error) throw new DbError("DB_ERROR", error.message);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return toPendingRow(data);
}

export async function fetchPendingRegistrationByDeviceWallet(
  deviceWallet: string,
): Promise<PendingRegistrationRow | null> {
  const wallet = normalizeWalletAddress(deviceWallet);
  const { data, error } = await getSupabaseAdmin()
    .from("device_registration_pending")
    .select("*")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw new DbError("DB_ERROR", error.message);
  if (!data) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return toPendingRow(data);
}
