import type { Hex } from "viem";
import { DbError } from "../errors";
import { fetchListings } from "./query";
import { ListingOpsSchema, PurchaseInfoSchema, SkillListingPayloadSchema } from "../types";

/** CDR purchase/decrypt projection (legacy Supabase row shape). */
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
  catalog_listing_id?: string;
  ipfs_gateway_url?: string | null;
}

function payloadToListing(
  listingId: string,
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
    catalog_listing_id: listingId,
    ipfs_gateway_url: ops.ipfsGatewayUrl ?? null,
  };
}

export async function fetchSkillListingFromCatalog(
  skillName: string,
  ownerAddress?: Hex,
): Promise<SkillCdrListing> {
  const rows = await fetchListings({
    skillSlug: skillName,
    limit: 1,
    scope: ownerAddress ? "mine" : undefined,
    ownerAddress,
  });
  if (!rows.length) {
    throw new DbError(
      "NOT_FOUND",
      `No catalog listing for "${skillName}". Run publish or npm run index-catalog.`,
    );
  }
  const row = rows[0];
  const raw = SkillListingPayloadSchema.parse(row.payload);
  if (!raw.ops) {
    throw new DbError(
      "VALIDATION_FAILED",
      `Listing for "${skillName}" missing ops block — re-publish to refresh catalog index.`,
    );
  }
  const listing = payloadToListing(row.listingId, raw);
  if (!listing.ipfs_gateway_url?.trim() && !listing.helia_peer_id?.trim()) {
    throw new DbError(
      "VALIDATION_FAILED",
      `Catalog listing for "${skillName}" missing ipfsGatewayUrl — re-distribute with Pinata API keys.`,
    );
  }
  return listing;
}

export async function fetchSkillListingByKey(listingId: Hex | string): Promise<SkillCdrListing> {
  const rows = await fetchListings({ listingKey: listingId, limit: 1 });
  if (!rows.length) {
    throw new DbError("NOT_FOUND", `No catalog listing for id ${listingId}`);
  }
  const row = rows[0];
  return payloadToListing(row.listingId, SkillListingPayloadSchema.parse(row.payload));
}

export async function fetchSkillPurchaseContext(skillName: string) {
  const listing = await fetchSkillListingFromCatalog(skillName);
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  const payload = rows[0]?.payload;
  return {
    listing,
    title: payload?.title ?? skillName,
    description: payload?.description ?? "",
    mintingFeeIp: listing.publisher_address ? payload?.purchase.mintingFeeIp ?? "1" : "1",
    entityKey: rows[0]?.listingId ?? "",
  };
}

export function purchaseContextFromCatalogSnapshot(
  entityKey: string,
  payload: unknown,
): {
  listing: SkillCdrListing;
  title: string;
  description: string;
  mintingFeeIp: string;
} {
  const raw = SkillListingPayloadSchema.parse(payload);
  if (!raw.ops) {
    throw new DbError("VALIDATION_FAILED", "Catalog snapshot missing ops block");
  }
  const listing = payloadToListing(entityKey, raw);
  const purchase = PurchaseInfoSchema.parse(raw.purchase);
  return {
    listing,
    title: raw.title,
    description: raw.description,
    mintingFeeIp: purchase.mintingFeeIp,
  };
}
