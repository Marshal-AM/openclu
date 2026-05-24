import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { buildTagCreate } from "../entities/tag.js";
import { buildVersionCreate } from "../entities/version.js";
import {
  buildTrainingListingCreate,
  buildTrainingListingUpdate,
} from "../entities/training-listing.js";
import { createArkivWalletClient, getCreatorWallet } from "../lib/client.js";
import { buildTrainingListingPayload } from "../lib/build-training-listing.js";
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
  TrainingDataListingPayload,
} from "../lib/types.js";
import {
  fetchTagEntityKeysForListing,
  fetchTrainingListings,
  getNextVersionNumber,
} from "./query-catalog.js";
import { writeManifestArkivFields } from "./publish-catalog.js";

export interface PublishTrainingCatalogInput {
  skillName: string;
  manifest: CdrManifest;
  bundleDir: string;
  publisherAddress?: Hex;
  ops: PublishCatalogOpsInput;
}

export async function publishTrainingCatalogToArkiv(
  input: PublishTrainingCatalogInput,
): Promise<PublishCatalogResult> {
  const publisher = input.publisherAddress ?? getCreatorWallet();
  const trainingMdPath = resolve(input.bundleDir, "TRAINING.md");
  const payload = buildTrainingListingPayload(
    input.manifest,
    trainingMdPath,
    input.bundleDir,
    publisher,
    input.ops,
  );
  const fm = parseSkillFrontmatter(readFileSync(trainingMdPath, "utf-8"));
  const baseTags = deriveTags(input.skillName, fm.triggers, payload.description);
  const tags = [
    ...new Set([...baseTags, "training", "trainingdata", ...(fm.extraTags ?? []).map((t) => t.toLowerCase())]),
  ];

  const finish = async (
    listingKey: Hex,
    version: number,
    entitiesTxHash: string,
    listingTxHash?: string,
  ): Promise<PublishCatalogResult> => {
    const rows = await fetchTrainingListings({ skillSlug: input.skillName, limit: 1 });
    const catalogPayload = rows[0]?.payload as TrainingDataListingPayload | undefined;
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
      catalogPayload: catalogPayload as PublishCatalogResult["catalogPayload"],
    };
  };

  const wallet = createArkivWalletClient();
  const publishedAtMs = Date.parse(input.manifest.publishedAt) || Date.now();
  let listingKey = input.manifest.arkivListingKey as Hex | undefined;
  let version = input.manifest.arkivVersion ?? 0;

  try {
    const existing = await fetchTrainingListings({ skillSlug: input.skillName, limit: 1 });
    if (existing.length) {
      listingKey = existing[0].entityKey as Hex;
    }

    if (listingKey) {
      const key = listingKey;
      await deleteTagEntities(key);
      version = await getNextVersionNumber(key);

      const listingUpdate = await wallet.mutateEntities({
        updates: [buildTrainingListingUpdate(key, payload, LISTING_STATUS.published)],
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

      return finish(key, version, second.txHash, listingUpdate.txHash);
    }

    const first = await wallet.mutateEntities({
      creates: [buildTrainingListingCreate(payload)],
    });
    const newKey = first.createdEntities[0];
    if (!newKey) throw new Error("Arkiv did not return training listing entity key");
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

    return finish(newKey, version, second.txHash, first.txHash);
  } catch (err) {
    throw wrapArkivError(err);
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
