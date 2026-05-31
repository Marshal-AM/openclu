import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { getSupabaseAdmin } from "../client.js";
import { getDeviceWalletAddress } from "../device-wallet.js";
import { buildTrainingListingPayload } from "../build-training-listing.js";
import { wrapDbError } from "../errors.js";
import { LISTING_STATUS } from "../constants.js";
import { deriveTags, parseSkillFrontmatter } from "../skill-md.js";
import { listingExpiresAt } from "../expiration.js";
import type {
  CdrManifest,
  PublishCatalogOpsInput,
  PublishCatalogResult,
  TrainingDataListingPayload,
} from "../types.js";
import { fetchTrainingListings, getNextVersionNumber } from "./query.js";
import { rowFromTrainingPayload } from "./row-mapper.js";
import { writeManifestCatalogFields } from "./publish-catalog.js";

export interface PublishTrainingCatalogInput {
  skillName: string;
  manifest: CdrManifest;
  bundleDir: string;
  publisherAddress?: Hex;
  ops: PublishCatalogOpsInput;
}

async function replaceTags(listingId: string, skillSlug: string, tags: string[]) {
  await getSupabaseAdmin().from("catalog_listing_tags").delete().eq("listing_id", listingId);
  if (!tags.length) return;
  const rows = tags.map((tag) => ({
    listing_id: listingId,
    skill_slug: skillSlug,
    tag: tag.toLowerCase(),
    label: tag,
  }));
  const { error } = await getSupabaseAdmin().from("catalog_listing_tags").insert(rows);
  if (error) throw wrapDbError(error);
}

async function insertVersion(listingId: string, skillSlug: string, version: number, manifest: CdrManifest) {
  const { error } = await getSupabaseAdmin().from("catalog_listing_versions").insert({
    listing_id: listingId,
    skill_slug: skillSlug,
    version,
    vault_uuid: manifest.vaultUuid,
    ip_id: manifest.ipId,
    license_terms_id: manifest.licenseTermsId,
    cid: manifest.cid,
    published_at: manifest.publishedAt,
  });
  if (error) throw wrapDbError(error);
}

export async function publishTrainingCatalog(
  input: PublishTrainingCatalogInput,
): Promise<PublishCatalogResult> {
  const publisher = (input.publisherAddress ?? getDeviceWalletAddress()) as Hex;
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
  const expiresAt = listingExpiresAt();

  let listingId = input.manifest.catalogListingId;
  let version = input.manifest.catalogVersion ?? 0;
  const existing = await fetchTrainingListings({ skillSlug: input.skillName, limit: 1 });
  if (existing.length) listingId = existing[0].listingId;

  const finish = async (id: string, ver: number): Promise<PublishCatalogResult> => {
    const rows = await fetchTrainingListings({ skillSlug: input.skillName, limit: 1 });
    return {
      listingId: id,
      listingKey: id,
      status: "published",
      version: ver,
      tagCount: tags.length,
      tags,
      publisherAddress: publisher,
      catalogPayload: rows[0]?.payload as PublishCatalogResult["catalogPayload"],
    };
  };

  try {
    if (listingId) {
      version = await getNextVersionNumber(listingId);
      const row = rowFromTrainingPayload(payload, {
        id: listingId,
        status: LISTING_STATUS.published,
        ownerWallet: publisher,
        creatorWallet: existing[0]?.creator ?? publisher,
        version,
        tagCursor: false,
        expiresAt,
      });
      const { error } = await getSupabaseAdmin()
        .from("catalog_listings")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", listingId);
      if (error) throw wrapDbError(error);
      await replaceTags(listingId, input.skillName, tags);
      await insertVersion(listingId, input.skillName, version, input.manifest);
      const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
      const fields = { catalogListingId: listingId, catalogStatus: "published", catalogVersion: version };
      writeManifestCatalogFields(manifestPath, fields);
      return finish(listingId, version);
    }

    version = 1;
    const row = rowFromTrainingPayload(payload, {
      status: LISTING_STATUS.published,
      ownerWallet: publisher,
      creatorWallet: publisher,
      version,
      tagCursor: false,
      expiresAt,
    });
    const { data, error } = await getSupabaseAdmin()
      .from("catalog_listings")
      .insert(row)
      .select("id")
      .single();
    if (error) throw wrapDbError(error);
    listingId = data.id;
    await replaceTags(listingId, input.skillName, tags);
    await insertVersion(listingId, input.skillName, version, input.manifest);
    const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
    const fields = { catalogListingId: listingId, catalogStatus: "published", catalogVersion: version };
    writeManifestCatalogFields(manifestPath, fields);
    return finish(listingId, version);
  } catch (err) {
    throw wrapDbError(err);
  }
}
