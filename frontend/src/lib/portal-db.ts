import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);

const SKILL_CAPTURE_ROOT = path.resolve(process.cwd(), "..", "skill-capture");
const ARKIV_DIR = path.join(SKILL_CAPTURE_ROOT, "arkiv");
const CLI_DIR = path.join(SKILL_CAPTURE_ROOT, "cli");
const CLI = path.join(ARKIV_DIR, "src", "cli", "portal-db-cli.ts");

function resolveTsxCli(): string {
  for (const dir of [ARKIV_DIR, CLI_DIR]) {
    const p = path.join(dir, "node_modules", "tsx", "dist", "cli.mjs");
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Arkiv tsx missing — run: cd skill-capture/arkiv && npm install && cd ../cli && npm install",
  );
}

async function runPortalCli<T>(cmd: string, payload?: Record<string, unknown>): Promise<T> {
  const tsxCli = resolveTsxCli();
  const args = [tsxCli, CLI, cmd];
  const env = { ...process.env } as NodeJS.ProcessEnv;
  if (payload !== undefined) {
    env.SKILL_CAPTURE_PORTAL_JSON = JSON.stringify(payload);
  }

  const { stdout } = await exec(process.execPath, args, {
    cwd: ARKIV_DIR,
    env,
    maxBuffer: 10 * 1024 * 1024,
    shell: false,
    windowsHide: true,
  });

  const parsed = JSON.parse(stdout.trim()) as T & { error?: string };
  if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

export type PortalDeviceRow = {
  id: string;
  device_id: string;
  device_name: string;
  wallet_address: string;
  owner_wallet_address: string;
  orchestrator_url: string | null;
  registration_token?: string | null;
  registered_at: string | null;
  created_at: string;
};

export type PortalProfile = {
  walletAddress: string;
  displayName: string | null;
  email: string | null;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastLoginAt: string | null;
};

export type PendingRegistrationRow = {
  registration_token: string;
  device_id: string;
  device_name: string;
  wallet_address: string;
  orchestrator_url: string | null;
  expires_at: string;
  created_at: string;
};

export function listPortalDevices(ownerWallet: string) {
  return runPortalCli<{ devices: PortalDeviceRow[] }>("list-devices", { ownerWallet });
}

export function getPortalDevice(ownerWallet: string, portalId: string) {
  return runPortalCli<{ device: PortalDeviceRow | null }>("get-device", { ownerWallet, portalId });
}

export function getPortalDeviceOrchestratorUrl(ownerWallet: string, portalId: string) {
  return runPortalCli<
    | { ok: true; url: string }
    | { ok: false; error: string; status: number }
  >("get-device-orchestrator-url", { ownerWallet, portalId });
}

export function getPortalUserProfile(wallet: string) {
  return runPortalCli<{ profile: PortalProfile }>("get-user", { wallet });
}

export function upsertPortalUserProfile(input: {
  walletAddress: string;
  displayName?: string | null;
  email?: string | null;
  bio?: string | null;
}) {
  return runPortalCli<{ profile: PortalProfile }>("upsert-user", input);
}

export function touchPortalLogin(wallet: string) {
  return runPortalCli<{ profile: PortalProfile }>("touch-login", { wallet });
}

export function upsertPortalUserAvatar(
  wallet: string,
  avatar: { mimeType: string; dataBase64: string },
) {
  return runPortalCli<{ avatarUrl: string }>("upsert-user-avatar", { wallet, avatar });
}

export function getPortalUserAvatar(wallet: string) {
  return runPortalCli<{ avatar: { mimeType: string; dataBase64: string } | null }>(
    "get-user-avatar",
    { wallet },
  );
}

export function updatePortalDevice(input: {
  ownerWallet: string;
  portalId: string;
  deviceId?: string;
  deviceName?: string;
  deviceWallet?: string;
  orchestratorUrl?: string | null;
  registrationToken?: string | null;
  registeredAt?: string | null;
}) {
  return runPortalCli<{ device: PortalDeviceRow }>("update-device", input);
}

export function upsertPortalDevice(input: {
  deviceId: string;
  deviceName: string;
  deviceWallet: string;
  ownerWallet: string;
  registrationToken?: string | null;
  registeredAt?: string | null;
  orchestratorUrl?: string | null;
  portalId?: string;
}) {
  return runPortalCli<{ device: PortalDeviceRow }>("upsert-device", input);
}

export function upsertPendingRegistration(input: {
  registrationToken: string;
  deviceId: string;
  deviceName: string;
  deviceWallet: string;
  orchestratorUrl?: string | null;
}) {
  return runPortalCli<{ pending: PendingRegistrationRow }>("upsert-pending", input);
}

export function getPendingRegistration(registrationToken: string) {
  return runPortalCli<{ pending: PendingRegistrationRow | null }>("get-pending", {
    registrationToken,
  });
}

export function deletePendingRegistration(registrationToken: string) {
  return runPortalCli<{ ok: boolean }>("delete-pending", { registrationToken });
}
