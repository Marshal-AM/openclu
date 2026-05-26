/**
 * Portal users + devices on Arkiv Braga — direct @arkiv-network/sdk (no skill-capture CLI).
 */
import {
  deletePendingRegistration as deletePendingRegistrationMutate,
  pendingToApiRow,
  portalDeviceToApiRow,
  portalUserToApiProfile,
  updatePortalDeviceForOwner,
  upsertPendingRegistration as upsertPendingRegistrationMutate,
  upsertPortalDevice as upsertPortalDeviceMutate,
  upsertPortalUser,
  type UpdatePortalDeviceInput,
  type UpsertPendingRegistrationInput,
  type UpsertPortalDeviceInput,
} from "./mutate";
import {
  fetchPortalDeviceByPortalId,
  fetchPortalDevicesForOwner,
  fetchPortalUser,
  fetchPendingRegistrationByToken,
} from "./query";
import type { PortalAvatar } from "./types";

export type PortalDeviceRow = ReturnType<typeof portalDeviceToApiRow>;
export type PortalProfile = ReturnType<typeof portalUserToApiProfile>;
export type PendingRegistrationRow = ReturnType<typeof pendingToApiRow>;

export async function listPortalDevices(ownerWallet: string) {
  const rows = await fetchPortalDevicesForOwner(ownerWallet);
  return { devices: rows.map(portalDeviceToApiRow) };
}

export async function getPortalDevice(ownerWallet: string, portalId: string) {
  const row = await fetchPortalDeviceByPortalId(ownerWallet, portalId);
  if (!row) return { device: null };
  return { device: portalDeviceToApiRow(row) };
}

export async function getPortalDeviceOrchestratorUrl(ownerWallet: string, portalId: string) {
  const row = await fetchPortalDeviceByPortalId(ownerWallet, portalId);
  if (!row) {
    return { ok: false as const, error: "Selected device not found for this owner.", status: 404 };
  }
  const orchestratorUrl = row.orchestratorUrl?.trim().replace(/\/$/, "");
  if (!orchestratorUrl) {
    return {
      ok: false as const,
      error:
        "Selected device has no portal URL. Re-run register.sh/register.ps1 with ngrok, then re-register this device.",
      status: 403,
    };
  }
  return { ok: true as const, url: orchestratorUrl };
}

export async function getPortalUserProfile(wallet: string) {
  const row = await fetchPortalUser(wallet);
  return { profile: portalUserToApiProfile(row, wallet) };
}

export async function upsertPortalUserProfile(input: {
  walletAddress: string;
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
}) {
  const row = await upsertPortalUser(input);
  return { profile: portalUserToApiProfile(row, row.walletAddress) };
}

export async function upsertPortalUserAvatar(wallet: string, avatar: PortalAvatar) {
  const row = await upsertPortalUser({ walletAddress: wallet, avatar });
  return {
    avatarUrl: `/api/profile/avatar/image?t=${Date.parse(row.updatedAt) || Date.now()}`,
  };
}

export async function getPortalUserAvatar(wallet: string) {
  const row = await fetchPortalUser(wallet);
  if (!row?.avatar) return { avatar: null as PortalAvatar | null };
  return { avatar: row.avatar };
}

export async function updatePortalDevice(input: UpdatePortalDeviceInput) {
  const row = await updatePortalDeviceForOwner(input);
  return { device: portalDeviceToApiRow(row) };
}

export async function upsertPortalDevice(input: UpsertPortalDeviceInput) {
  const row = await upsertPortalDeviceMutate(input);
  return { device: portalDeviceToApiRow(row) };
}

export async function upsertPendingRegistration(input: UpsertPendingRegistrationInput) {
  const row = await upsertPendingRegistrationMutate(input);
  return { pending: pendingToApiRow(row) };
}

export async function getPendingRegistration(registrationToken: string) {
  const row = await fetchPendingRegistrationByToken(registrationToken);
  if (!row) return { pending: null };
  return { pending: pendingToApiRow(row) };
}

export async function deletePendingRegistration(registrationToken: string) {
  await deletePendingRegistrationMutate(registrationToken);
  return { ok: true };
}
