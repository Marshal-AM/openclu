import type { Hex } from "viem";
import { DbError } from "../errors.js";
import {
  fetchSkillListingByKey,
  fetchSkillListingFromCatalog,
  type SkillCdrListing,
} from "./cdr-listing.js";
import {
  fetchListings,
  fetchTrainingListings,
  fetchTagsForListing,
  type ListingFilters,
} from "./query.js";
import {
  SkillListingPayloadSchema,
  TrainingDataListingPayloadSchema,
  type SkillListingPayload,
  type TrainingDataListingPayload,
} from "../types.js";

export type CatalogDetailScope = Pick<ListingFilters, "ownerAddress" | "listingKey"> & {
  scope?: ListingFilters["scope"];
};

export interface CatalogListingDetail {
  listingId: string;
  entityKey: string;
  status: string;
  owner?: string;
  creator?: string;
  catalogVersion: number;
  payload: SkillListingPayload;
  tags: string[];
  purchaseView: SkillCdrListing;
}

function listingFiltersForDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): ListingFilters {
  if (scope?.listingKey) {
    return {
      listingKey: scope.listingKey,
      scope: scope.scope ?? "marketplace",
      limit: 1,
    };
  }
  return {
    skillSlug: skillName,
    ownerAddress: scope?.ownerAddress,
    scope: scope?.scope ?? (scope?.ownerAddress ? "mine" : "marketplace"),
    limit: 1,
  };
}

export async function fetchSkillCatalogDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): Promise<CatalogListingDetail> {
  const rows = await fetchListings(listingFiltersForDetail(skillName, scope));
  if (!rows.length) {
    throw new DbError(
      "NOT_FOUND",
      `No catalog listing for "${skillName}". Run publish or npm run index-catalog.`,
    );
  }
  const row = rows[0];
  const payload = SkillListingPayloadSchema.parse(row.payload);
  const tags = await fetchTagsForListing(row.listingId);
  const purchaseView = scope?.listingKey
    ? await fetchSkillListingByKey(scope.listingKey)
    : await fetchSkillListingFromCatalog(
        skillName,
        scope?.scope === "mine" ? (scope?.ownerAddress as Hex | undefined) : undefined,
      );

  return {
    listingId: row.listingId,
    entityKey: row.listingId,
    status: row.status,
    owner: row.owner,
    creator: row.creator,
    catalogVersion: row.version,
    payload,
    tags,
    purchaseView,
  };
}

export interface TrainingCatalogListingDetail {
  listingId: string;
  entityKey: string;
  status: string;
  owner?: string;
  creator?: string;
  catalogVersion: number;
  payload: TrainingDataListingPayload;
  tags: string[];
}

export async function fetchTrainingCatalogDetail(
  skillName: string,
  scope?: CatalogDetailScope,
): Promise<TrainingCatalogListingDetail> {
  const rows = await fetchTrainingListings(listingFiltersForDetail(skillName, scope));
  if (!rows.length) {
    throw new DbError("NOT_FOUND", `No training data listing for "${skillName}".`);
  }
  const row = rows[0];
  const payload = TrainingDataListingPayloadSchema.parse(row.payload);
  const tags = await fetchTagsForListing(row.listingId);
  return {
    listingId: row.listingId,
    entityKey: row.listingId,
    status: row.status,
    owner: row.owner,
    creator: row.creator,
    catalogVersion: row.version,
    payload,
    tags,
  };
}
