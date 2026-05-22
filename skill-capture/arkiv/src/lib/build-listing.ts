import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import {
  buildSearchText,
  deriveTags,
  parseSkillFrontmatter,
} from "./skill-md.js";
import type {
  CdrManifest,
  PublishCatalogOpsInput,
  SkillListingPayload,
} from "./types.js";
import { SkillListingPayloadSchema } from "./types.js";

export function loadManifestAndSkillMd(
  skillName: string,
  bundleDir?: string,
): { manifest: CdrManifest; skillMdPath: string } {
  const base = bundleDir ?? resolve(process.cwd(), "..", "skills", skillName);
  const manifestPath = resolve(base, "cdr-manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as CdrManifest;
  if (manifest.skillName && manifest.skillName !== skillName) {
    throw new Error(`Manifest skillName ${manifest.skillName} != ${skillName}`);
  }
  manifest.skillName = skillName;
  return { manifest, skillMdPath: resolve(base, "SKILL.md"), bundleDir: base };
}

export function buildListingPayload(
  manifest: CdrManifest,
  skillMdPath: string,
  publisherAddress: Hex,
  ops: PublishCatalogOpsInput,
): SkillListingPayload {
  const fm = parseSkillFrontmatter(readFileSync(skillMdPath, "utf-8"));
  const title = fm.name ? fm.name.replace(/-/g, " ") : `Skill: ${manifest.skillName}`;
  const description = fm.description ?? `Recorded skill ${manifest.skillName}`;
  const tags = deriveTags(manifest.skillName, fm.triggers, description);
  const searchText = buildSearchText(manifest.skillName, title, description, fm.triggers, tags);

  const payload: SkillListingPayload = {
    skillName: manifest.skillName,
    title,
    description,
    expertiseSource: fm.expertiseSource,
    recordedAt: fm.recordedAt,
    searchText,
    triggers: fm.triggers,
    triggerCount: fm.triggers.length,
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
    },
  };

  return SkillListingPayloadSchema.parse(payload);
}
