/**
 * Server-only portal reads/writes for Next.js (Arkiv public + portal wallet client).
 */
import { loadArkivEnv } from "./lib/env.js";
import {
  fetchPendingRegistrationByToken,
  fetchPortalDeviceByPortalId,
  fetchPortalDevicesForOwner,
  fetchPortalUser,
} from "./services/query-portal.js";
import {
  deletePendingRegistration,
  pendingToApiRow,
  portalDeviceToApiRow,
  portalUserToApiProfile,
  upsertPendingRegistration,
  upsertPortalDevice,
  upsertPortalUser,
  updatePortalDeviceForOwner,
  type UpdatePortalDeviceInput,
  type UpsertPendingRegistrationInput,
  type UpsertPortalDeviceInput,
  type UpsertPortalUserInput,
} from "./services/mutate-portal.js";
import type { PortalAvatar } from "./lib/portal-types.js";

loadArkivEnv();

export async function portalListDevices(ownerWallet: string) {
  const rows = await fetchPortalDevicesForOwner(ownerWallet);
  return { devices: rows.map(portalDeviceToApiRow) };
}

export async function portalGetDevice(ownerWallet: string, portalId: string) {
  const row = await fetchPortalDeviceByPortalId(ownerWallet, portalId);
  if (!row) return { device: null };
  return { device: portalDeviceToApiRow(row) };
}

export async function portalGetDeviceOrchestratorUrl(ownerWallet: string, portalId: string) {
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

export async function portalGetUserProfile(wallet: string) {
  const row = await fetchPortalUser(wallet);
  return { profile: portalUserToApiProfile(row, wallet) };
}

export async function portalUpsertUser(input: UpsertPortalUserInput) {
  const row = await upsertPortalUser(input);
  return { profile: portalUserToApiProfile(row, row.walletAddress) };
}

export async function portalUpsertUserAvatar(wallet: string, avatar: PortalAvatar) {
  const row = await upsertPortalUser({ walletAddress: wallet, avatar });
  return {
    avatarUrl: `/api/profile/avatar/image?t=${Date.parse(row.updatedAt) || Date.now()}`,
  };
}

export async function portalGetUserAvatar(wallet: string) {
  const row = await fetchPortalUser(wallet);
  if (!row?.avatar) return { avatar: null };
  return { avatar: row.avatar };
}

export async function portalUpdateDevice(input: UpdatePortalDeviceInput) {
  const row = await updatePortalDeviceForOwner(input);
  return { device: portalDeviceToApiRow(row) };
}

export async function portalUpsertDevice(input: UpsertPortalDeviceInput) {
  const row = await upsertPortalDevice(input);
  return { device: portalDeviceToApiRow(row) };
}

export async function portalUpsertPending(input: UpsertPendingRegistrationInput) {
  const row = await upsertPendingRegistration(input);
  return { pending: pendingToApiRow(row) };
}

export async function portalGetPending(registrationToken: string) {
  const row = await fetchPendingRegistrationByToken(registrationToken);
  if (!row) return { pending: null };
  return { pending: pendingToApiRow(row) };
}

export async function portalDeletePending(registrationToken: string) {
  await deletePendingRegistration(registrationToken);
  return { ok: true };
}

export async function portalTouchLogin(wallet: string) {
  return portalUpsertUser({ walletAddress: wallet, lastLoginAt: new Date().toISOString() });
}
