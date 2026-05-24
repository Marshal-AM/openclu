import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { buildSearchText, deriveTags, parseSkillFrontmatter } from "./skill-md.js";
import type {
  CdrManifest,
  PublishCatalogOpsInput,
  TrainingDataListingPayload,
} from "./types.js";
import { TrainingDataListingPayloadSchema } from "./types.js";

export function buildTrainingListingPayload(
  manifest: CdrManifest,
  trainingMdPath: string,
  bundleDir: string,
  publisherAddress: Hex,
  ops: PublishCatalogOpsInput,
): TrainingDataListingPayload {
  const fm = parseSkillFrontmatter(readFileSync(trainingMdPath, "utf-8"));
  const title = fm.name ? fm.name.replace(/-/g, " ") : `Training: ${manifest.skillName}`;
  const description = fm.description ?? `Training data video ${manifest.skillName}`;
  const tags = deriveTags(manifest.skillName, fm.triggers, description);
  const searchText = buildSearchText(manifest.skillName, title, description, fm.triggers, [
    ...tags,
    "training",
    "trainingdata",
  ]);

  const metaPath = resolve(bundleDir, "video.meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
    mimeType?: string;
    recordedAt?: string;
  };

  const payload: TrainingDataListingPayload = {
    skillName: manifest.skillName,
    title,
    description,
    expertiseSource: fm.expertiseSource,
    recordedAt: fm.recordedAt ?? meta.recordedAt,
    searchText,
    triggers: [],
    triggerCount: 0,
    contentKind: "trainingData",
    videoMime: meta.mimeType ?? "video/webm",
    purchase: {
      vaultUuid: manifest.vaultUuid,
      ipId: manifest.ipId,
      licenseTermsId: manifest.licenseTermsId,
      cid: manifest.cid,
      mintingFeeIp: manifest.mintingFeeIp ?? "1",
      network: manifest.network ?? "aeneid",
      publishedAt: manifest.publishedAt,
      publisherAddress,
    },
    ops: {
      heliaPeerId: ops.peerHints.helia_peer_id,
      heliaMultiaddrs: ops.peerHints.helia_multiaddrs,
      encryptedSizeBytes: ops.encryptedSizeBytes,
      readConditionAddress: ops.readConditionAddress,
      writeConditionAddress: ops.writeConditionAddress,
      licenseTokenAddress: ops.licenseTokenAddress,
      storyApiUrl: ops.storyApiUrl,
      rpcUrl: ops.rpcUrl,
      ...(ops.ipfsGatewayUrl ? { ipfsGatewayUrl: ops.ipfsGatewayUrl } : {}),
    },
  };

  return TrainingDataListingPayloadSchema.parse(payload);
}
