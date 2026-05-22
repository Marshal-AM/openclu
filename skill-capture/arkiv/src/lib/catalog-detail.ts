import type { Hex } from "viem";
import { ArkivError } from "./errors.js";
import { fetchSkillListingFromArkiv, type SkillCdrListing } from "./cdr-listing.js";
import {
  fetchListings,
  fetchTagsForListing,
  getNextVersionNumber,
} from "../services/query-catalog.js";
import { SkillListingPayloadSchema, type SkillListingPayload } from "./types.js";

/** Full Arkiv catalog row for UI / debugging (not stripped to CDR purchase view). */
export interface CatalogListingDetail {
  entityKey: string;
  status: string;
  owner?: string;
  creator?: string;
  arkivVersion: number;
  payload: SkillListingPayload;
  tags: string[];
  /** Legacy purchase/decrypt projection (subset of payload + ops). */
  purchaseView: SkillCdrListing;
}

export async function fetchSkillCatalogDetail(skillName: string): Promise<CatalogListingDetail> {
  const rows = await fetchListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new ArkivError(
      "NOT_FOUND",
      `No Arkiv catalog listing for "${skillName}". Run publish or npm run index-arkiv.`,
    );
  }
  const row = rows[0];
  const payload = SkillListingPayloadSchema.parse(row.payload);
  const listingKey = row.entityKey as Hex;
  const tags = await fetchTagsForListing(listingKey);
  const next = await getNextVersionNumber(listingKey);
  const arkivVersion = Math.max(1, next - 1);
  const purchaseView = await fetchSkillListingFromArkiv(skillName);

  return {
    entityKey: row.entityKey,
    status: row.status,
    owner: row.owner,
    creator: row.creator,
    arkivVersion,
    payload,
    tags,
    purchaseView,
  };
}
