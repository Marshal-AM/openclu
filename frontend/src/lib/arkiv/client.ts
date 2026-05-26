import { createPublicClient, http } from "@arkiv-network/sdk";
import { braga } from "@arkiv-network/sdk/chains";

/** Shared read-only Arkiv client (Braga testnet). */
export function createArkivPublicClient() {
  return createPublicClient({
    chain: braga,
    transport: http(),
  });
}
