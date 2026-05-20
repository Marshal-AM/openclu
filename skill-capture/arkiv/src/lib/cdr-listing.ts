import type { Hex } from "viem";
import { ArkivError } from "./errors.js";
import { fetchListings } from "../services/query-catalog.js";
import { ListingOpsSchema, PurchaseInfoSchema, SkillListingPayloadSchema } from "./types.js";

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
  };
}

export async function fetchSkillListingFromArkiv(
  skillName: string,
): Promise<SkillCdrListing> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new ArkivError(
      "NOT_FOUND",
      `No Arkiv catalog listing for "${skillName}". Run publish or npm run index-arkiv.`,
    );
  }
  const row = rows[0];
  const raw = SkillListingPayloadSchema.parse(row.payload);
  if (!raw.ops) {
    throw new ArkivError(
      "VALIDATION_FAILED",
      `Listing for "${skillName}" missing ops block — re-publish to refresh Arkiv index.`,
    );
  }
  const listing = payloadToListing(row.entityKey, raw);
  if (!listing.helia_peer_id) {
    throw new ArkivError(
      "VALIDATION_FAILED",
      `Arkiv listing for "${skillName}" missing heliaPeerId.`,
    );
  }
  return listing;
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
