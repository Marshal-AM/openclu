import type { Hex } from "viem";
import { ArkivError } from "./errors.js";
import {
  fetchSkillListingByKey,
  fetchSkillListingFromArkiv,
  type SkillCdrListing,
} from "./cdr-listing.js";
import {
  fetchListings,
  fetchTrainingListings,
  fetchTagsForListing,
  getNextVersionNumber,
  type ListingFilters,
} from "../services/query-catalog.js";
import {
  SkillListingPayloadSchema,
  TrainingDataListingPayloadSchema,
  type SkillListingPayload,
  type TrainingDataListingPayload,
} from "./types.js";

export type CatalogDetailScope = Pick<ListingFilters, "ownerAddress" | "listingKey">;

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

function listingFiltersForDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): ListingFilters {
  if (scope?.listingKey) {
    return {
      listingKey: scope.listingKey as Hex,
      ownerAddress: scope.ownerAddress as Hex | undefined,
      scope: "mine",
    };
  }
  return {
    skillSlug: skillName,
    ownerAddress: scope?.ownerAddress as Hex | undefined,
    scope: "mine",
    limit: 1,
  };
}

export async function fetchSkillCatalogDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): Promise<CatalogListingDetail> {
  const rows = await fetchListings(listingFiltersForDetail(skillName, scope));
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
  const purchaseView = scope?.listingKey
    ? await fetchSkillListingByKey(listingKey)
    : await fetchSkillListingFromArkiv(skillName, scope?.ownerAddress as Hex | undefined);

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

/** Full training-data listing for UI (parallel to skill catalog detail). */
export interface TrainingCatalogListingDetail {
  entityKey: string;
  status: string;
  owner?: string;
  creator?: string;
  arkivVersion: number;
  payload: TrainingDataListingPayload;
  tags: string[];
}

export async function fetchTrainingCatalogDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): Promise<TrainingCatalogListingDetail> {
  const rows = await fetchTrainingListings(listingFiltersForDetail(skillName, scope));
  if (!rows.length) {
    throw new ArkivError("NOT_FOUND", `No training data listing for "${skillName}".`);
  }
  const row = rows[0];
  const payload = TrainingDataListingPayloadSchema.parse(row.payload);
  const listingKey = row.entityKey as Hex;
  const tags = await fetchTagsForListing(listingKey);
  const next = await getNextVersionNumber(listingKey);
  const arkivVersion = Math.max(1, next - 1);
  return {
    entityKey: row.entityKey,
    status: row.status,
    owner: row.owner,
    creator: row.creator,
    arkivVersion,
    payload,
    tags,
  };
}
