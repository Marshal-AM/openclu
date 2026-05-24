import type { Hex } from "viem";
import { ArkivError } from "./errors.js";
import { fetchListings, fetchTrainingListings } from "../services/query-catalog.js";
import {
  ListingOpsSchema,
  PurchaseInfoSchema,
  SkillListingPayloadSchema,
} from "./types.js";

/** Same shape as legacy Supabase row — used by CDR purchase/decrypt. */
export interface SkillCdrListing {
  skill_name: string;
  vault_uuid: number;
  ip_id: string;
  license_terms_id: string;
  cid: string;
  encrypted_size_bytes: number | null;
  network: string;
  publisher_address: string | null;
  read_condition_address: string | null;
  write_condition_address: string | null;
  license_token_address: string | null;
  helia_peer_id: string | null;
  helia_multiaddrs: string[];
  story_api_url: string | null;
  rpc_url: string | null;
  manifest_path: string | null;
  published_at?: string;
  arkiv_listing_key?: string;
  ipfs_gateway_url?: string | null;
}

function payloadToListing(
  entityKey: string,
  raw: ReturnType<typeof SkillListingPayloadSchema.parse>,
): SkillCdrListing {
  const ops = ListingOpsSchema.parse(raw.ops);
  const purchase = PurchaseInfoSchema.parse(raw.purchase);
  return {
    skill_name: raw.skillName,
    vault_uuid: purchase.vaultUuid,
    ip_id: purchase.ipId,
    license_terms_id: purchase.licenseTermsId,
    cid: purchase.cid,
    encrypted_size_bytes: ops.encryptedSizeBytes,
    network: purchase.network,
    publisher_address: purchase.publisherAddress,
    read_condition_address: ops.readConditionAddress,
    write_condition_address: ops.writeConditionAddress,
    license_token_address: ops.licenseTokenAddress,
    helia_peer_id: ops.heliaPeerId,
    helia_multiaddrs: ops.heliaMultiaddrs,
    story_api_url: ops.storyApiUrl,
    rpc_url: ops.rpcUrl,
    manifest_path: null,
    published_at: purchase.publishedAt,
    arkiv_listing_key: entityKey,
    ipfs_gateway_url: ops.ipfsGatewayUrl ?? null,
  };
}

export interface SkillPurchaseContext {
  listing: SkillCdrListing;
  title: string;
  description: string;
  mintingFeeIp: string;
}

/** Build listing + metadata from UI catalog JSON (no extra Arkiv round-trip). */
export function purchaseContextFromCatalogSnapshot(
  entityKey: string,
  payload: unknown,
): SkillPurchaseContext {
  const raw = SkillListingPayloadSchema.parse(payload);
  if (!raw.ops) {
    throw new ArkivError(
      "VALIDATION_FAILED",
      "Catalog payload missing ops block (helia peer hints).",
    );
  }
  const listing = payloadToListing(entityKey, raw);
  if (!listing.ipfs_gateway_url?.trim() && !listing.helia_peer_id?.trim()) {
    throw new ArkivError(
      "VALIDATION_FAILED",
      "Catalog missing ipfsGatewayUrl — re-publish or run npm run repin-pinata.",
    );
  }
  const purchase = PurchaseInfoSchema.parse(raw.purchase);
  return {
    listing,
    title: raw.title,
    description: raw.description,
    mintingFeeIp: purchase.mintingFeeIp,
  };
}

export async function fetchSkillPurchaseContext(
  skillName: string,
): Promise<SkillPurchaseContext> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new ArkivError(
      "NOT_FOUND",
      `No Arkiv catalog listing for "${skillName}".`,
    );
  }
  const row = rows[0];
  return purchaseContextFromCatalogSnapshot(row.entityKey, row.payload);
}

export async function fetchSkillListingFromArkiv(
  skillName: string,
): Promise<SkillCdrListing> {
  const ctx = await fetchSkillPurchaseContext(skillName);
  return ctx.listing;
}

export async function fetchTrainingPurchaseContext(
  skillName: string,
): Promise<SkillPurchaseContext> {
  const rows = await fetchTrainingListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new ArkivError(
      "NOT_FOUND",
      `No Arkiv training data listing for "${skillName}".`,
    );
  }
  const row = rows[0];
  return purchaseContextFromCatalogSnapshot(row.entityKey, row.payload);
}

export async function fetchTrainingListingFromArkiv(
  skillName: string,
): Promise<SkillCdrListing> {
  const ctx = await fetchTrainingPurchaseContext(skillName);
  return ctx.listing;
}

export async function fetchSkillListingByKey(
  listingKey: Hex,
): Promise<SkillCdrListing> {
  const rows = await fetchListings({ listingKey, limit: 1 });
  if (!rows.length) {
    throw new ArkivError("NOT_FOUND", `No Arkiv entity for key ${listingKey}`);
  }
  const row = rows[0];
  return payloadToListing(row.entityKey, SkillListingPayloadSchema.parse(row.payload));
}
