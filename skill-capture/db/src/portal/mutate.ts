import { randomUUID } from "node:crypto";
import { getSupabaseAdmin, normalizeWalletAddress } from "../client.js";
import { DbError, wrapDbError } from "../errors.js";
import { pendingRegistrationExpiresAt } from "../expiration.js";
import type {
  PendingRegistrationPayload,
  PortalAvatar,
  PortalDevicePayload,
  PortalDeviceRow,
  PortalUserPayload,
  PortalUserRow,
} from "../portal-types.js";
import {
  fetchPendingRegistrationByDeviceWallet,
  fetchPendingRegistrationByToken,
  fetchPortalDeviceByDeviceWallet,
  fetchPortalDeviceByPortalId,
  fetchPortalUser,
} from "./query.js";

export type UpsertPortalUserInput = {
  walletAddress: string;
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
  avatar?: PortalAvatar | null;
  lastLoginAt?: string | null;
};

export type UpdatePortalDeviceInput = {
  ownerWallet: string;
  portalId: string;
  deviceId?: string;
  deviceName?: string;
  deviceWallet?: string;
  orchestratorUrl?: string | null;
  registrationToken?: string | null;
  registeredAt?: string | null;
};

export type UpsertPortalDeviceInput = {
  deviceId: string;
  deviceName: string;
  deviceWallet: string;
  ownerWallet: string;
  registrationToken?: string | null;
  registeredAt?: string | null;
  orchestratorUrl?: string | null;
  portalId?: string;
};

export type UpsertPendingRegistrationInput = {
  registrationToken: string;
  deviceId: string;
  deviceName: string;
  deviceWallet: string;
  orchestratorUrl?: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertPortalUser(input: UpsertPortalUserInput): Promise<PortalUserRow> {
  const wallet = normalizeWalletAddress(input.walletAddress);
  const existing = await fetchPortalUser(wallet);
  const now = nowIso();
  const row = {
    wallet_address: wallet,
    display_name:
      input.displayName !== undefined ? input.displayName : (existing?.displayName ?? null),
    email: input.email !== undefined ? input.email : (existing?.email ?? null),
    bio: input.bio !== undefined ? input.bio : (existing?.bio ?? null),
    last_login_at:
      input.lastLoginAt !== undefined ? input.lastLoginAt : (existing?.lastLoginAt ?? now),
    updated_at: now,
    ...(existing ? {} : { created_at: now }),
  };

  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .upsert(row, { onConflict: "wallet_address" })
    .select("*")
    .single();
  if (error) throw wrapDbError(error);

  if (input.avatar?.dataBase64) {
    const avatarUrl = await uploadUserAvatar(wallet, input.avatar);
    return {
      walletAddress: data.wallet_address,
      displayName: data.display_name,
      email: data.email,
      bio: data.bio,
      avatar: null,
      avatarUrl,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      lastLoginAt: data.last_login_at,
      entityKey: data.wallet_address,
    };
  }

  return {
    walletAddress: data.wallet_address,
    displayName: data.display_name,
    email: data.email,
    bio: data.bio,
    avatar: null,
    avatarUrl: data.avatar_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastLoginAt: data.last_login_at,
    entityKey: data.wallet_address,
  };
}

async function uploadUserAvatar(wallet: string, avatar: PortalAvatar): Promise<string> {
  const bytes = Buffer.from(avatar.dataBase64, "base64");
  const ext = avatar.mimeType.split("/")[1] ?? "bin";
  const path = `${wallet}/avatar.${ext}`;
  const sb = getSupabaseAdmin();
  const { error: upErr } = await sb.storage.from("profile-avatars").upload(path, bytes, {
    contentType: avatar.mimeType,
    upsert: true,
  });
  if (upErr) throw wrapDbError(upErr);
  const { data: pub } = sb.storage.from("profile-avatars").getPublicUrl(path);
  const avatarUrl = pub.publicUrl;
  const { error } = await sb.from("users").update({ avatar_url: avatarUrl }).eq("wallet_address", wallet);
  if (error) throw wrapDbError(error);
  return avatarUrl;
}

export async function updatePortalDeviceForOwner(
  input: UpdatePortalDeviceInput,
): Promise<PortalDeviceRow> {
  const ownerWallet = normalizeWalletAddress(input.ownerWallet);
  const existing = await fetchPortalDeviceByPortalId(ownerWallet, input.portalId);
  if (!existing) {
    throw new DbError("NOT_FOUND", "Device not found for this owner");
  }

  const orchestratorUrl =
    input.orchestratorUrl !== undefined
      ? input.orchestratorUrl?.trim().replace(/\/$/, "") || null
      : existing.orchestratorUrl;

  const patch = {
    device_id: input.deviceId?.trim() || existing.deviceId,
    device_name: input.deviceName?.trim() || existing.deviceName,
    wallet_address: input.deviceWallet
      ? normalizeWalletAddress(input.deviceWallet)
      : existing.deviceWallet,
    registration_token:
      input.registrationToken !== undefined ? input.registrationToken : existing.registrationToken,
    registered_at: input.registeredAt !== undefined ? input.registeredAt : existing.registeredAt,
    orchestrator_url: orchestratorUrl,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("devices")
    .update(patch)
    .eq("id", existing.portalId)
    .eq("owner_wallet_address", ownerWallet)
    .select("*")
    .single();
  if (error) throw wrapDbError(error);
  return {
    portalId: data.id,
    deviceId: data.device_id,
    deviceName: data.device_name,
    deviceWallet: data.wallet_address,
    ownerWallet: data.owner_wallet_address,
    registrationToken: data.registration_token,
    registeredAt: data.registered_at,
    orchestratorUrl: data.orchestrator_url,
    createdAt: data.created_at,
    entityKey: data.id,
  };
}

export async function upsertPortalDevice(input: UpsertPortalDeviceInput): Promise<PortalDeviceRow> {
  const ownerWallet = normalizeWalletAddress(input.ownerWallet);
  const deviceWallet = normalizeWalletAddress(input.deviceWallet);
  const orchestratorUrl = input.orchestratorUrl?.trim().replace(/\/$/, "") || null;
  const existing = await fetchPortalDeviceByDeviceWallet(deviceWallet);
  const now = nowIso();
  const id = input.portalId ?? existing?.portalId ?? randomUUID();

  const row = {
    id,
    device_id: input.deviceId,
    device_name: input.deviceName,
    wallet_address: deviceWallet,
    owner_wallet_address: ownerWallet,
    registration_token: input.registrationToken ?? existing?.registrationToken ?? null,
    registered_at: input.registeredAt ?? existing?.registeredAt ?? now,
    orchestrator_url: orchestratorUrl ?? existing?.orchestratorUrl ?? null,
    created_at: existing?.createdAt ?? now,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("devices")
    .upsert(row, { onConflict: "wallet_address" })
    .select("*")
    .single();
  if (error) throw wrapDbError(error);

  return {
    portalId: data.id,
    deviceId: data.device_id,
    deviceName: data.device_name,
    deviceWallet: data.wallet_address,
    ownerWallet: data.owner_wallet_address,
    registrationToken: data.registration_token,
    registeredAt: data.registered_at,
    orchestratorUrl: data.orchestrator_url,
    createdAt: data.created_at,
    entityKey: data.id,
  };
}

export async function upsertPendingRegistration(
  input: UpsertPendingRegistrationInput,
): Promise<PendingRegistrationPayload & { entityKey: string }> {
  const deviceWallet = normalizeWalletAddress(input.deviceWallet);
  const orchestratorUrl = input.orchestratorUrl?.trim().replace(/\/$/, "") || null;
  const now = nowIso();
  const expiresAt = pendingRegistrationExpiresAt();

  const row = {
    registration_token: input.registrationToken,
    device_id: input.deviceId,
    device_name: input.deviceName,
    wallet_address: deviceWallet,
    orchestrator_url: orchestratorUrl,
    created_at: now,
    expires_at: expiresAt,
  };

  const existing =
    (await fetchPendingRegistrationByToken(input.registrationToken)) ??
    (await fetchPendingRegistrationByDeviceWallet(deviceWallet));

  if (existing) {
    const { error } = await getSupabaseAdmin()
      .from("device_registration_pending")
      .update(row)
      .eq("registration_token", existing.registrationToken);
    if (error) throw wrapDbError(error);
  } else {
    const { error } = await getSupabaseAdmin()
      .from("device_registration_pending")
      .insert(row);
    if (error) throw wrapDbError(error);
  }

  const payload: PendingRegistrationPayload = {
    registrationToken: row.registration_token,
    deviceId: row.device_id,
    deviceName: row.device_name,
    deviceWallet: row.wallet_address,
    orchestratorUrl: row.orchestrator_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
  return { ...payload, entityKey: row.registration_token };
}

export async function deletePendingRegistration(registrationToken: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("device_registration_pending")
    .delete()
    .eq("registration_token", registrationToken);
  if (error) throw wrapDbError(error);
}

export function portalDeviceToApiRow(row: PortalDeviceRow) {
  return {
    id: row.portalId,
    device_id: row.deviceId,
    device_name: row.deviceName,
    wallet_address: row.deviceWallet,
    owner_wallet_address: row.ownerWallet,
    orchestrator_url: row.orchestratorUrl,
    registration_token: row.registrationToken ?? null,
    registered_at: row.registeredAt,
    created_at: row.createdAt,
  };
}

export function portalUserToApiProfile(row: PortalUserRow | null, wallet: string) {
  const now = nowIso();
  const source = row ?? {
    walletAddress: wallet,
    displayName: null,
    email: null,
    bio: null,
    avatar: null,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    entityKey: wallet,
  };
  const avatarUrl =
    source.avatarUrl ??
    (source.avatar
      ? `/api/profile/avatar/image?t=${Date.parse(source.updatedAt) || Date.now()}`
      : null);
  return {
    walletAddress: source.walletAddress,
    displayName: source.displayName ?? null,
    email: source.email ?? null,
    bio: source.bio ?? null,
    avatarUrl,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    lastLoginAt: source.lastLoginAt ?? null,
  };
}

export function pendingToApiRow(row: PendingRegistrationPayload) {
  return {
    registration_token: row.registrationToken,
    device_id: row.deviceId,
    device_name: row.deviceName,
    wallet_address: row.deviceWallet,
    orchestrator_url: row.orchestratorUrl,
    expires_at: row.expiresAt,
    created_at: row.createdAt,
  };
}
