import { randomUUID } from "node:crypto";
import type { Hex } from "viem";
import { buildPortalDeviceCreate, buildPortalDeviceUpdate } from "../entities/portal-device.js";
import { buildPendingRegistrationCreate, buildPendingRegistrationUpdate } from "../entities/portal-pending.js";
import { buildPortalUserCreate, buildPortalUserUpdate } from "../entities/portal-user.js";
import { createPortalWalletClient, normalizeWalletAddress } from "../lib/portal-client.js";
import { pendingRegistrationExpiresIn } from "../lib/portal-expiration.js";
import { ArkivError, wrapArkivError } from "../lib/errors.js";
import type {
  PendingRegistrationPayload,
  PortalAvatar,
  PortalDevicePayload,
  PortalDeviceRow,
  PortalUserPayload,
  PortalUserRow,
} from "../lib/portal-types.js";
import {
  fetchPendingRegistrationByDeviceWallet,
  fetchPendingRegistrationByToken,
  fetchPendingRegistrationEntityKey,
  fetchPortalDeviceByDeviceWallet,
  fetchPortalDeviceByPortalId,
  fetchPortalUser,
} from "./query-portal.js";

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
  const payload: PortalUserPayload = {
    walletAddress: wallet,
    displayName: input.displayName !== undefined ? input.displayName : (existing?.displayName ?? null),
    email: input.email !== undefined ? input.email : (existing?.email ?? null),
    bio: input.bio !== undefined ? input.bio : (existing?.bio ?? null),
    avatar: input.avatar !== undefined ? input.avatar : (existing?.avatar ?? null),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: input.lastLoginAt !== undefined ? input.lastLoginAt : (existing?.lastLoginAt ?? now),
  };

  const walletClient = createPortalWalletClient();
  try {
    if (existing) {
      await walletClient.updateEntity(
        buildPortalUserUpdate(existing.entityKey as Hex, payload),
      );
      return { ...payload, entityKey: existing.entityKey };
    }
    const { entityKey } = await walletClient.createEntity(buildPortalUserCreate(payload));
    return { ...payload, entityKey };
  } catch (err) {
    throw wrapArkivError(err);
  }
}

export async function updatePortalDeviceForOwner(
  input: UpdatePortalDeviceInput,
): Promise<PortalDeviceRow> {
  const ownerWallet = normalizeWalletAddress(input.ownerWallet);
  const existing = await fetchPortalDeviceByPortalId(ownerWallet, input.portalId);
  if (!existing) {
    throw new ArkivError("NOT_FOUND", "Device not found for this owner");
  }

  const orchestratorUrl =
    input.orchestratorUrl !== undefined
      ? input.orchestratorUrl?.trim().replace(/\/$/, "") || null
      : existing.orchestratorUrl;

  const payload: PortalDevicePayload = {
    portalId: existing.portalId,
    deviceId: input.deviceId?.trim() || existing.deviceId,
    deviceName: input.deviceName?.trim() || existing.deviceName,
    deviceWallet: input.deviceWallet
      ? normalizeWalletAddress(input.deviceWallet)
      : existing.deviceWallet,
    ownerWallet: existing.ownerWallet,
    registrationToken:
      input.registrationToken !== undefined ? input.registrationToken : existing.registrationToken,
    registeredAt: input.registeredAt !== undefined ? input.registeredAt : existing.registeredAt,
    orchestratorUrl,
    createdAt: existing.createdAt,
  };

  const walletClient = createPortalWalletClient();
  try {
    await walletClient.updateEntity(
      buildPortalDeviceUpdate(existing.entityKey as Hex, payload),
    );
    return { ...payload, entityKey: existing.entityKey };
  } catch (err) {
    throw wrapArkivError(err);
  }
}

export async function upsertPortalDevice(input: UpsertPortalDeviceInput): Promise<PortalDeviceRow> {
  const ownerWallet = normalizeWalletAddress(input.ownerWallet);
  const deviceWallet = normalizeWalletAddress(input.deviceWallet);
  const orchestratorUrl = input.orchestratorUrl?.trim().replace(/\/$/, "") || null;
  const existing = await fetchPortalDeviceByDeviceWallet(deviceWallet);
  const now = nowIso();
  const payload: PortalDevicePayload = {
    portalId: input.portalId ?? existing?.portalId ?? randomUUID(),
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    deviceWallet,
    ownerWallet,
    registrationToken: input.registrationToken ?? existing?.registrationToken ?? null,
    registeredAt: input.registeredAt ?? existing?.registeredAt ?? now,
    orchestratorUrl: orchestratorUrl ?? existing?.orchestratorUrl ?? null,
    createdAt: existing?.createdAt ?? now,
  };

  const walletClient = createPortalWalletClient();
  try {
    if (existing) {
      await walletClient.updateEntity(
        buildPortalDeviceUpdate(existing.entityKey as Hex, payload),
      );
      return { ...payload, entityKey: existing.entityKey };
    }
    const { entityKey } = await walletClient.createEntity(buildPortalDeviceCreate(payload));
    return { ...payload, entityKey };
  } catch (err) {
    throw wrapArkivError(err);
  }
}

export async function upsertPendingRegistration(
  input: UpsertPendingRegistrationInput,
): Promise<PendingRegistrationPayload & { entityKey: string }> {
  const deviceWallet = normalizeWalletAddress(input.deviceWallet);
  const orchestratorUrl = input.orchestratorUrl?.trim().replace(/\/$/, "") || null;
  const now = nowIso();
  const expiresAt = new Date(Date.now() + pendingRegistrationExpiresIn() * 1000).toISOString();
  const payload: PendingRegistrationPayload = {
    registrationToken: input.registrationToken,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    deviceWallet,
    orchestratorUrl,
    createdAt: now,
    expiresAt,
  };

  const existing =
    (await fetchPendingRegistrationByToken(input.registrationToken)) ??
    (await fetchPendingRegistrationByDeviceWallet(deviceWallet));

  const walletClient = createPortalWalletClient();
  try {
    if (existing) {
      await walletClient.updateEntity(
        buildPendingRegistrationUpdate(existing.entityKey as Hex, payload),
      );
      return { ...payload, entityKey: existing.entityKey };
    }
    const { entityKey } = await walletClient.createEntity(buildPendingRegistrationCreate(payload));
    return { ...payload, entityKey };
  } catch (err) {
    throw wrapArkivError(err);
  }
}

export async function deletePendingRegistration(registrationToken: string): Promise<void> {
  const entityKey = await fetchPendingRegistrationEntityKey(registrationToken);
  if (!entityKey) return;
  const walletClient = createPortalWalletClient();
  try {
    await walletClient.mutateEntities({ deletes: [{ entityKey }] });
  } catch (err) {
    throw wrapArkivError(err);
  }
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
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
    entityKey: "",
  };
  return {
    walletAddress: source.walletAddress,
    displayName: source.displayName ?? null,
    email: source.email ?? null,
    bio: source.bio ?? null,
    avatarUrl: source.avatar
      ? `/api/profile/avatar/image?t=${Date.parse(source.updatedAt) || Date.now()}`
      : null,
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
