import { createWalletClient, http } from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { braga } from "@arkiv-network/sdk/chains";
import type { Hex } from "viem";
import { createArkivPublicClient } from "@/lib/arkiv/client";
import { ArkivError } from "@/lib/arkiv/errors";

let cachedPortalAddress: Hex | null = null;

function normalizePrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new ArkivError("CONFIG_MISSING", "PORTAL_WALLET_PRIVATE_KEY must be a 32-byte hex key");
  }
  return `0x${trimmed}` as `0x${string}`;
}

function portalPrivateKey(): string {
  const raw = process.env.PORTAL_WALLET_PRIVATE_KEY;
  if (!raw?.trim()) {
    throw new ArkivError(
      "CONFIG_MISSING",
      "PORTAL_WALLET_PRIVATE_KEY missing — set in frontend/.env for portal writes",
    );
  }
  return raw;
}

export function normalizeWalletAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function getPortalWalletAddress(): Hex {
  if (cachedPortalAddress) return cachedPortalAddress;
  const fromEnv = process.env.PORTAL_WALLET_ADDRESS?.trim();
  if (fromEnv) {
    cachedPortalAddress = (fromEnv.startsWith("0x") ? fromEnv : `0x${fromEnv}`) as Hex;
    return cachedPortalAddress;
  }
  cachedPortalAddress = privateKeyToAccount(normalizePrivateKey(portalPrivateKey())).address;
  return cachedPortalAddress;
}

export function createPortalWalletClient() {
  return createWalletClient({
    chain: braga,
    transport: http(),
    account: privateKeyToAccount(normalizePrivateKey(portalPrivateKey())),
  });
}

export function createPortalPublicClient() {
  return createArkivPublicClient();
}
