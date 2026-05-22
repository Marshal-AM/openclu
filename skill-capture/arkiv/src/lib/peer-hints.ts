import type { HeliaPeerHints } from "./types.js";

/** Placeholder when delivery is public IPFS (Pinata) only. */
export const EMPTY_PEER_HINTS: HeliaPeerHints = {
  helia_peer_id: "",
  helia_multiaddrs: [],
};

export function peerHintsFromManifestFields(manifest: {
  heliaPeerId?: string;
  heliaMultiaddrs?: string[];
}): HeliaPeerHints {
  if (manifest.heliaPeerId?.trim() && manifest.heliaMultiaddrs?.length) {
    return {
      helia_peer_id: manifest.heliaPeerId.trim(),
      helia_multiaddrs: manifest.heliaMultiaddrs,
    };
  }
  return EMPTY_PEER_HINTS;
}

export function hasPublicIpfsDelivery(manifest: {
  ipfsGatewayUrl?: string;
}): boolean {
  return Boolean(manifest.ipfsGatewayUrl?.trim());
}

export function assertManifestDeliveryConfig(manifest: {
  heliaPeerId?: string;
  heliaMultiaddrs?: string[];
  ipfsGatewayUrl?: string;
}): void {
  if (hasPublicIpfsDelivery(manifest)) return;
  if (manifest.heliaPeerId?.trim() && manifest.heliaMultiaddrs?.length) return;
  throw new Error(
    "manifest needs ipfsGatewayUrl (Pinata at distribute) or heliaPeerId + heliaMultiaddrs",
  );
}
