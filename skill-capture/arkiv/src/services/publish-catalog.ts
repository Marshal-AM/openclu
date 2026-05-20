import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { buildListingCreate, buildListingUpdate } from "../entities/listing.js";
import { buildTagCreate } from "../entities/tag.js";
import { buildVersionCreate } from "../entities/version.js";
import { createArkivWalletClient, getCreatorWallet } from "../lib/client.js";
import { buildListingPayload, loadManifestAndSkillMd } from "../lib/build-listing.js";
import { listingOpsToPublishInput } from "../lib/ops-input.js";
import { ListingOpsSchema } from "../lib/types.js";
import { listingExpiresIn } from "../lib/expiration.js";
import { arkivTxUrl, ARKIV_BRAGA_EXPLORER } from "../lib/explorer-links.js";
import { braga } from "@arkiv-network/sdk/chains";
import { wrapArkivError } from "../lib/errors.js";
import { LISTING_STATUS } from "../lib/constants.js";
import { deriveTags, parseSkillFrontmatter } from "../lib/skill-md.js";
import type {
  CdrManifest,
  PublishCatalogOpsInput,
  PublishCatalogResult,
  SkillListingPayload,
} from "../lib/types.js";
import {
  fetchTagEntityKeysForListing,
  fetchListings,
  getNextVersionNumber,
} from "./query-catalog.js";

export interface PublishCatalogInput {
  skillName: string;
  manifest: CdrManifest;
  bundleDir: string;
  publisherAddress?: Hex;
  ops: PublishCatalogOpsInput;
}

export function writeManifestArkivFields(
  manifestPath: string,
  fields: { arkivListingKey: string; arkivStatus: string; arkivVersion: number },
): void {
  const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
  Object.assign(raw, fields);
  writeFileSync(manifestPath, JSON.stringify(raw, null, 2), "utf-8");
}

function syncRegistryManifest(skillName: string, bundleDir: string, fields: {
  arkivListingKey: string;
  arkivStatus: string;
  arkivVersion: number;
}): void {
  const registryPath = resolve(bundleDir, "..", "registry", `${skillName}.json`);
  try {
    writeManifestArkivFields(registryPath, fields);
  } catch {
    /* registry may not exist yet */
  }
}

async function deleteTagEntities(listingKey: Hex): Promise<void> {
  const wallet = createArkivWalletClient();
  const tagKeys = await fetchTagEntityKeysForListing(listingKey);
  if (!tagKeys.length) return;
  await wallet.mutateEntities({
    deletes: tagKeys.map((entityKey) => ({ entityKey })),
  });
}

export async function publishCatalogToArkiv(
  input: PublishCatalogInput,
): Promise<PublishCatalogResult> {
  const publisher = input.publisherAddress ?? getCreatorWallet();
  const { skillMdPath } = {
    skillMdPath: resolve(input.bundleDir, "SKILL.md"),
  };
  const payload = buildListingPayload(
    input.manifest,
    skillMdPath,
    publisher,
    input.ops,
  );
  const fm = parseSkillFrontmatter(readFileSync(skillMdPath, "utf-8"));
  const baseTags = deriveTags(input.skillName, fm.triggers, payload.description);
  const tagCursor = Boolean(fm.tagCursor);
  const tags = [...new Set([...baseTags, ...(fm.extraTags ?? []).map((t) => t.toLowerCase())])];

  const finish = async (
    listingKey: Hex,
    version: number,
    entitiesTxHash: string,
    listingTxHash?: string,
  ): Promise<PublishCatalogResult> => {
    const rows = await fetchListings({ skillSlug: input.skillName, limit: 1 });
    const catalogPayload = rows[0]?.payload as SkillListingPayload | undefined;
    return {
      listingKey,
      status: "published",
      version,
      tagCount: tags.length,
      tags,
      txHash: entitiesTxHash,
      listingTxHash,
      chainId: braga.id,
      chainName: braga.name,
      publisherAddress: publisher,
      explorerBaseUrl: ARKIV_BRAGA_EXPLORER,
      urls: {
        entitiesTx: arkivTxUrl(entitiesTxHash),
        listingTx: listingTxHash ? arkivTxUrl(listingTxHash) : undefined,
      },
      catalogPayload,
    };
  };

  const wallet = createArkivWalletClient();
  const publishedAtMs = Date.parse(input.manifest.publishedAt) || Date.now();
  let listingKey = input.manifest.arkivListingKey as Hex | undefined;
  let version = input.manifest.arkivVersion ?? 0;

  try {
    const existing = await fetchListings({ skillSlug: input.skillName, limit: 1 });
    if (existing.length) {
      listingKey = existing[0].entityKey as Hex;
    }

    if (listingKey) {
      const key = listingKey;
      await deleteTagEntities(key);
      version = await getNextVersionNumber(key);

      const listingUpdate = await wallet.mutateEntities({
        updates: [buildListingUpdate(key, payload, LISTING_STATUS.published, tagCursor)],
        extensions: [{ entityKey: key, expiresIn: listingExpiresIn() }],
      });

      const tagCreates = tags.map((tag) =>
        buildTagCreate(
          {
            listingKey: key,
            skillSlug: input.skillName,
            tag: tag.toLowerCase(),
            label: tag,
          },
          publishedAtMs,
        ),
      );

      const versionCreate = buildVersionCreate(
        {
          listingKey: key,
          skillSlug: input.skillName,
          version,
          vaultUuid: input.manifest.vaultUuid,
          ipId: input.manifest.ipId,
          licenseTermsId: input.manifest.licenseTermsId,
          cid: input.manifest.cid,
          publishedAt: input.manifest.publishedAt,
        },
        publishedAtMs,
      );

      const second = await wallet.mutateEntities({
        creates: [...tagCreates, versionCreate],
      });

      const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
      const arkivFields = {
        arkivListingKey: key,
        arkivStatus: "published",
        arkivVersion: version,
      };
      writeManifestArkivFields(manifestPath, arkivFields);
      syncRegistryManifest(input.skillName, input.bundleDir, arkivFields);

      return finish(key, version, second.txHash, listingUpdate.txHash);
    }

    const first = await wallet.mutateEntities({
      creates: [buildListingCreate(payload, tagCursor)],
    });
    const newKey = first.createdEntities[0];
    if (!newKey) throw new Error("Arkiv did not return listing entity key");
    listingKey = newKey;

    version = 1;
    const tagCreates = tags.map((tag) =>
      buildTagCreate(
        {
          listingKey: newKey,
          skillSlug: input.skillName,
          tag: tag.toLowerCase(),
          label: tag,
        },
        publishedAtMs,
      ),
    );

    const versionCreate = buildVersionCreate(
      {
        listingKey: newKey,
        skillSlug: input.skillName,
        version: 1,
        vaultUuid: input.manifest.vaultUuid,
        ipId: input.manifest.ipId,
        licenseTermsId: input.manifest.licenseTermsId,
        cid: input.manifest.cid,
        publishedAt: input.manifest.publishedAt,
      },
      publishedAtMs,
    );

    const second = await wallet.mutateEntities({
      creates: [...tagCreates, versionCreate],
    });

    const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
    const arkivFields = {
      arkivListingKey: newKey,
      arkivStatus: "published",
      arkivVersion: version,
    };
    writeManifestArkivFields(manifestPath, arkivFields);
    syncRegistryManifest(input.skillName, input.bundleDir, arkivFields);

    return finish(newKey, version, second.txHash, first.txHash);
  } catch (err) {
    throw wrapArkivError(err);
  }
}

/** CLI / standalone index from skill name (requires ops — use indexSkillWithHints from CDR). */
export async function indexSkillByName(
  skillName: string,
  bundleDir?: string,
  ops?: PublishCatalogOpsInput,
): Promise<PublishCatalogResult> {
  const { manifest } = loadManifestAndSkillMd(skillName, bundleDir);
  const dir = bundleDir ?? resolve(process.cwd(), "..", "skills", skillName);
  let resolvedOps = ops;
  if (!resolvedOps) {
    const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
    if (rows[0]?.payload.ops) {
      resolvedOps = listingOpsToPublishInput(
        ListingOpsSchema.parse(rows[0].payload.ops),
      );
    }
  }
  if (!resolvedOps) {
    throw new Error(
      "indexSkillByName requires ops — use CDR npm run index-arkiv or pass peer hints.",
    );
  }
  return publishCatalogToArkiv({
    skillName,
    manifest,
    bundleDir: dir,
    ops: resolvedOps,
  });
}
