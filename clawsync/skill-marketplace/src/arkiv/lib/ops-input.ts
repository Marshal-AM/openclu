import type { ListingOps, PublishCatalogOpsInput } from "./types.js";

export function listingOpsToPublishInput(ops: ListingOps): PublishCatalogOpsInput {
  return {
    peerHints: {
      helia_peer_id: ops.heliaPeerId,
      helia_multiaddrs: ops.heliaMultiaddrs,
    },
    encryptedSizeBytes: ops.encryptedSizeBytes,
    readConditionAddress: ops.readConditionAddress,
    writeConditionAddress: ops.writeConditionAddress,
    licenseTokenAddress: ops.licenseTokenAddress,
    storyApiUrl: ops.storyApiUrl,
    rpcUrl: ops.rpcUrl,
    ipfsGatewayUrl: ops.ipfsGatewayUrl,
  };
}
