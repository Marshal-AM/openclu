import type { Hex } from "viem";
import { buildListingUpdate } from "../entities/listing.js";
import { LISTING_STATUS } from "../lib/constants.js";
import { createArkivWalletClient, getCreatorWallet } from "../lib/client.js";
import { buildListingPayload, loadManifestAndSkillMd } from "../lib/build-listing.js";
import { listingOpsToPublishInput } from "../lib/ops-input.js";
import { ListingOpsSchema } from "../lib/types.js";
import { wrapArkivError } from "../lib/errors.js";
import { fetchListings, fetchTagEntityKeysForListing } from "./query-catalog.js";
import { writeManifestArkivFields } from "./publish-catalog.js";
import { resolve } from "node:path";

export async function archiveSkillCatalog(skillName: string): Promise<{ listingKey: string; txHash: string }> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new Error(`No Arkiv listing for skill "${skillName}"`);
  }
  const listingKey = rows[0].entityKey as Hex;
  const { manifest, skillMdPath, bundleDir } = loadManifestAndSkillMd(skillName);
  const manifestPath = resolve(bundleDir, "cdr-manifest.json");
  const existingOps = rows[0].payload.ops
    ? listingOpsToPublishInput(ListingOpsSchema.parse(rows[0].payload.ops))
    : undefined;
  if (!existingOps) {
    throw new Error(`Listing for "${skillName}" missing ops — re-publish via CDR first.`);
  }
  const payload = buildListingPayload(
    manifest,
    skillMdPath,
    getCreatorWallet(),
    existingOps,
  );
  const wallet = createArkivWalletClient();

  try {
    const tagKeys = await fetchTagEntityKeysForListing(listingKey);
    if (tagKeys.length) {
      await wallet.mutateEntities({ deletes: tagKeys.map((entityKey) => ({ entityKey })) });
    }
    const { txHash } = await wallet.updateEntity(
      buildListingUpdate(listingKey, payload, LISTING_STATUS.archived),
    );

    const version = manifest.arkivVersion ?? 0;
    const arkivFields = {
      arkivListingKey: listingKey,
      arkivStatus: LISTING_STATUS.archived,
      arkivVersion: version,
    };
    writeManifestArkivFields(manifestPath, arkivFields);
    try {
      const registryPath = resolve(bundleDir, "..", "registry", `${skillName}.json`);
      writeManifestArkivFields(registryPath, arkivFields);
    } catch {
      /* registry optional */
    }

    return { listingKey, txHash };
  } catch (err) {
    throw wrapArkivError(err);
  }
}
