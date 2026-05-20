/**
 * Device contributor wallet — loaded only from skill-capture/.env on the local machine.
 * Never send DEVICE_WALLET_PRIVATE_KEY over HTTP or to the browser.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import type { Hex } from "viem";

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
/** skill-capture repo root (parent of arkiv/) */
export const SKILL_CAPTURE_ROOT = resolve(LIB_DIR, "../../..");

let envLoaded = false;

export function loadSkillCaptureEnv(): void {
  if (envLoaded) return;
  const rootEnv = resolve(SKILL_CAPTURE_ROOT, ".env");
  if (existsSync(rootEnv)) config({ path: rootEnv });
  config({ override: false });
  envLoaded = true;
}

function normalizePrivateKey(raw: string): Hex {
  const trimmed = raw.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("DEVICE_WALLET_PRIVATE_KEY must be a 32-byte hex key");
  }
  return `0x${trimmed}` as Hex;
}

let cachedAccount: PrivateKeyAccount | null = null;

export function loadDeviceAccount(): PrivateKeyAccount {
  loadSkillCaptureEnv();
  if (cachedAccount) return cachedAccount;
  const raw = process.env.DEVICE_WALLET_PRIVATE_KEY;
  if (!raw?.trim()) {
    throw new Error(
      "DEVICE_WALLET_PRIVATE_KEY missing — run skill-capture/register.sh first",
    );
  }
  cachedAccount = privateKeyToAccount(normalizePrivateKey(raw));
  return cachedAccount;
}

export function getDeviceWalletAddress(): Hex {
  loadSkillCaptureEnv();
  const fromEnv = process.env.DEVICE_WALLET_ADDRESS?.trim();
  if (fromEnv) {
    return (fromEnv.startsWith("0x") ? fromEnv : `0x${fromEnv}`) as Hex;
  }
  return loadDeviceAccount().address;
}

export function getDeviceId(): string {
  loadSkillCaptureEnv();
  const id = process.env.DEVICE_ID?.trim();
  if (!id) throw new Error("DEVICE_ID missing — run register.sh");
  return id;
}

export function getRegistrationToken(): string | undefined {
  loadSkillCaptureEnv();
  return process.env.REGISTRATION_TOKEN?.trim();
}
