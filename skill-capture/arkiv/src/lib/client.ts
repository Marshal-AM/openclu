import { createPublicClient, createWalletClient, http } from "@arkiv-network/sdk";
import { loadArkivEnv } from "./env.js";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";
import type { Hex } from "viem";
import { ArkivError } from "./errors.js";

loadArkivEnv();

let cachedDevice: Hex | null = null;

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new ArkivError("CONFIG_MISSING", "DEVICE_WALLET_PRIVATE_KEY must be a 32-byte hex key");
  }
  return `0x${trimmed}` as `0x${string}`;
}

function devicePrivateKey(): string {
  const raw = process.env.DEVICE_WALLET_PRIVATE_KEY;
  if (!raw?.trim()) {
    throw new ArkivError(
      "CONFIG_MISSING",
      "DEVICE_WALLET_PRIVATE_KEY missing — run skill-capture/register.sh",
    );
  }
  return raw;
}

/** Device contributor address (Arkiv $owner after local publish). */
export function getCreatorWallet(): Hex {
  if (cachedDevice) return cachedDevice;
  const fromEnv = process.env.DEVICE_WALLET_ADDRESS?.trim();
  if (fromEnv) {
    cachedDevice = (fromEnv.startsWith("0x") ? fromEnv : `0x${fromEnv}`) as Hex;
    return cachedDevice;
  }
  cachedDevice = privateKeyToAccount(normalizePrivateKey(devicePrivateKey())).address;
  return cachedDevice;
}

export function createArkivWalletClient() {
  return createWalletClient({
    chain: braga,
    transport: http(),
    account: privateKeyToAccount(normalizePrivateKey(devicePrivateKey())),
  });
}

export function createArkivPublicClient() {
  return createPublicClient({
    chain: braga,
    transport: http(),
  });
}
