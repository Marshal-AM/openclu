import { createPublicClient, http } from "@arkiv-network/sdk";
import { loadArkivEnv } from "./env.js";
import { braga } from "@arkiv-network/sdk/chains";
import type { Hex } from "viem";
import { getAgentBuyerAddress } from "./agent-wallet.js";

loadArkivEnv();

/** Arkiv $owner filter for "mine" scope — uses AGENT_PRIVATE_KEY address. */
export function getCreatorWallet(): Hex {
  const agent = getAgentBuyerAddress();
  if (!agent) {
    throw new Error(
      "AGENT_PRIVATE_KEY is required for 'mine' catalog scope. Set it in Convex env.",
    );
  }
  return agent;
}

export function createArkivPublicClient() {
  return createPublicClient({
    chain: braga,
    transport: http(),
  });
}
