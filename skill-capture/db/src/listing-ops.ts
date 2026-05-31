import {
  assertManifestDeliveryConfig,
  peerHintsFromManifestFields,
} from "./peer-hints.js";
import type { PublishCatalogOpsInput } from "./types.js";

const DEFAULT_READ = "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3";
const DEFAULT_WRITE = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";
const DEFAULT_LICENSE = "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC";

export function buildOpsFromManifest(manifest: {
  heliaPeerId?: string;
  heliaMultiaddrs?: string[];
  encryptedSizeBytes?: number;
  readCondition?: string;
  writeCondition?: string;
  licenseToken?: string;
  storyApiUrl?: string;
  rpcUrl?: string;
  ipfsGatewayUrl?: string;
}): PublishCatalogOpsInput {
  assertManifestDeliveryConfig(manifest);
  return {
    peerHints: peerHintsFromManifestFields(manifest),
    encryptedSizeBytes: manifest.encryptedSizeBytes ?? 0,
    readConditionAddress: manifest.readCondition ?? DEFAULT_READ,
    writeConditionAddress: manifest.writeCondition ?? DEFAULT_WRITE,
    licenseTokenAddress: manifest.licenseToken ?? DEFAULT_LICENSE,
    storyApiUrl: manifest.storyApiUrl ?? process.env.API_URL ?? "http://172.192.41.96:1317",
    rpcUrl: manifest.rpcUrl ?? process.env.RPC_URL ?? "https://aeneid.storyrpc.io",
    ...(manifest.ipfsGatewayUrl ? { ipfsGatewayUrl: manifest.ipfsGatewayUrl } : {}),
  };
}
