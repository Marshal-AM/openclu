import { resolve } from "node:path";
import { getSupabaseAdmin } from "../client.js";
import { getDeviceWalletAddress } from "../device-wallet.js";
import { buildListingPayload, loadManifestAndSkillMd } from "../build-listing.js";
import { listingOpsToPublishInput } from "../ops-input.js";
import { ListingOpsSchema } from "../types.js";
import { wrapDbError } from "../errors.js";
import { LISTING_STATUS } from "../constants.js";
import { fetchListings } from "./query.js";
import { rowFromSkillPayload } from "./row-mapper.js";
import { writeManifestCatalogFields } from "./publish-catalog.js";

export async function archiveSkillCatalog(
  skillName: string,
): Promise<{ listingId: string; listingKey: string }> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new Error(`No catalog listing for skill "${skillName}"`);
  }
  const listingId = rows[0].listingId;
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
    getDeviceWalletAddress(),
    existingOps,
  );
  const row = rowFromSkillPayload(payload, {
    id: listingId,
    status: LISTING_STATUS.archived,
    ownerWallet: rows[0].owner ?? getDeviceWalletAddress(),
    creatorWallet: rows[0].creator ?? getDeviceWalletAddress(),
    version: rows[0].version,
    tagCursor: false,
  });

  try {
    await getSupabaseAdmin().from("catalog_listing_tags").delete().eq("listing_id", listingId);
    const { error } = await getSupabaseAdmin()
      .from("catalog_listings")
      .update({
        status: LISTING_STATUS.archived,
        payload,
        search_text: row.search_text,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId);
    if (error) throw wrapDbError(error);

    const fields = {
      catalogListingId: listingId,
      catalogStatus: LISTING_STATUS.archived,
      catalogVersion: rows[0].version,
    };
    writeManifestCatalogFields(manifestPath, fields);
    try {
      writeManifestCatalogFields(resolve(bundleDir, "..", "registry", `${skillName}.json`), fields);
    } catch {
      /* optional */
    }
    return { listingId, listingKey: listingId };
  } catch (err) {
    throw wrapDbError(err);
  }
}
