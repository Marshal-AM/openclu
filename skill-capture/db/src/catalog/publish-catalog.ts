import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Hex } from "viem";
import { getSupabaseAdmin } from "../client.js";
import { getDeviceWalletAddress } from "../device-wallet.js";
import { buildListingPayload, loadManifestAndSkillMd } from "../build-listing.js";
import { listingOpsToPublishInput } from "../ops-input.js";
import { wrapDbError } from "../errors.js";
import { LISTING_STATUS } from "../constants.js";
import { deriveTags, parseSkillFrontmatter } from "../skill-md.js";
import { listingExpiresAt } from "../expiration.js";
import type {
  CdrManifest,
  PublishCatalogOpsInput,
  PublishCatalogResult,
  SkillListingPayload,
} from "../types.js";
import { ListingOpsSchema } from "../types.js";
import { fetchListings, getNextVersionNumber } from "./query.js";
import { rowFromSkillPayload } from "./row-mapper.js";

export interface PublishCatalogInput {
  skillName: string;
  manifest: CdrManifest;
  bundleDir: string;
  publisherAddress?: Hex;
  ops: PublishCatalogOpsInput;
}

export function writeManifestCatalogFields(
  manifestPath: string,
  fields: { catalogListingId: string; catalogStatus: string; catalogVersion: number },
): void {
  const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
  raw.catalogListingId = fields.catalogListingId;
  raw.catalogStatus = fields.catalogStatus;
  raw.catalogVersion = fields.catalogVersion;
  delete raw.arkivListingKey;
  delete raw.arkivStatus;
  delete raw.arkivVersion;
  writeFileSync(manifestPath, JSON.stringify(raw, null, 2), "utf-8");
}

function syncRegistryManifest(skillName: string, bundleDir: string, fields: {
  catalogListingId: string;
  catalogStatus: string;
  catalogVersion: number;
}): void {
  const registryPath = resolve(bundleDir, "..", "registry", `${skillName}.json`);
  try {
    writeManifestCatalogFields(registryPath, fields);
  } catch {
    /* optional */
  }
}

async function replaceTags(listingId: string, skillSlug: string, tags: string[], publishedAtMs: number) {
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
  void publishedAtMs;
}

async function insertVersion(
  listingId: string,
  skillSlug: string,
  version: number,
  manifest: CdrManifest,
) {
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

export async function publishCatalogToDb(
  input: PublishCatalogInput,
): Promise<PublishCatalogResult> {
  const publisher = (input.publisherAddress ?? getDeviceWalletAddress()) as Hex;
  const skillMdPath = resolve(input.bundleDir, "SKILL.md");
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
  const publishedAtMs = Date.parse(input.manifest.publishedAt) || Date.now();
  const expiresAt = listingExpiresAt();

  let listingId = input.manifest.catalogListingId;
  let version = input.manifest.catalogVersion ?? 0;

  const existing = await fetchListings({ skillSlug: input.skillName, limit: 1 });
  if (existing.length) listingId = existing[0].listingId;

  const finish = async (id: string, ver: number): Promise<PublishCatalogResult> => {
    const rows = await fetchListings({ skillSlug: input.skillName, limit: 1 });
    const catalogPayload = rows[0]?.payload as SkillListingPayload | undefined;
    return {
      listingId: id,
      listingKey: id,
      status: "published",
      version: ver,
      tagCount: tags.length,
      tags,
      publisherAddress: publisher,
      catalogPayload,
    };
  };

  try {
    if (listingId) {
      version = await getNextVersionNumber(listingId);
      const row = rowFromSkillPayload(payload, {
        id: listingId,
        status: LISTING_STATUS.published,
        ownerWallet: publisher,
        creatorWallet: existing[0]?.creator ?? publisher,
        version,
        tagCursor,
        expiresAt,
      });
      const { error } = await getSupabaseAdmin()
        .from("catalog_listings")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", listingId);
      if (error) throw wrapDbError(error);
      await replaceTags(listingId, input.skillName, tags, publishedAtMs);
      await insertVersion(listingId, input.skillName, version, input.manifest);
      const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
      const fields = { catalogListingId: listingId, catalogStatus: "published", catalogVersion: version };
      writeManifestCatalogFields(manifestPath, fields);
      syncRegistryManifest(input.skillName, input.bundleDir, fields);
      return finish(listingId, version);
    }

    version = 1;
    const row = rowFromSkillPayload(payload, {
      status: LISTING_STATUS.published,
      ownerWallet: publisher,
      creatorWallet: publisher,
      version,
      tagCursor,
      expiresAt,
    });
    const { data, error } = await getSupabaseAdmin()
      .from("catalog_listings")
      .insert(row)
      .select("id")
      .single();
    if (error) throw wrapDbError(error);
    listingId = data.id;
    await replaceTags(listingId, input.skillName, tags, publishedAtMs);
    await insertVersion(listingId, input.skillName, version, input.manifest);
    const manifestPath = resolve(input.bundleDir, "cdr-manifest.json");
    const fields = { catalogListingId: listingId, catalogStatus: "published", catalogVersion: version };
    writeManifestCatalogFields(manifestPath, fields);
    syncRegistryManifest(input.skillName, input.bundleDir, fields);
    return finish(listingId, version);
  } catch (err) {
    throw wrapDbError(err);
  }
}

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
      resolvedOps = listingOpsToPublishInput(ListingOpsSchema.parse(rows[0].payload.ops));
    }
  }
  if (!resolvedOps) {
    throw new Error("indexSkillByName requires ops — pass peer hints from CDR distribute.");
  }
  return publishCatalogToDb({ skillName, manifest, bundleDir: dir, ops: resolvedOps });
}
