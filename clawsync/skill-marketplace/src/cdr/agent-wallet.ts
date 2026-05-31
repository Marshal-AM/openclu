import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

export function normalizeAgentPrivateKey(raw: string): `0x${string}` {
  const trimmed = raw.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error("AGENT_PRIVATE_KEY must be a 32-byte hex key (with or without 0x prefix)");
  }
  return `0x${trimmed}` as `0x${string}`;
}

/** Buyer wallet address from AGENT_PRIVATE_KEY (ClawSync agent account). */
export function getAgentBuyerAddress(): Hex | null {
  const raw = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return privateKeyToAccount(normalizeAgentPrivateKey(raw)).address;
}

export function requireAgentPrivateKey(): `0x${string}` {
  const raw = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error(
      "AGENT_PRIVATE_KEY is not set. Add it to Convex env (local dev) for skill purchases.",
    );
  }
  return normalizeAgentPrivateKey(raw);
}
