/**
 * Server-only catalog reads for Next.js (public client — no private key).
 */
import { loadArkivEnv } from "./lib/env.js";
import { fetchSkillCatalogDetail } from "./lib/catalog-detail.js";
import { fetchSkillListingFromArkiv } from "./lib/cdr-listing.js";
import {
  getCatalogStats,
  searchNaturalLanguage,
  searchTrainingNaturalLanguage,
  fetchTrainingListings,
  fetchTagsForListing,
  type ListingFilters,
  type ListingQueryScope,
} from "./services/query-catalog.js";

loadArkivEnv();

export interface CatalogQueryBody {
  query?: string;
  tag?: string;
  status?: ListingFilters["status"];
  since?: number;
  until?: number;
  listingKey?: string;
  minScore?: number;
  skillSlug?: string;
  ownerAddress?: string;
  createdByAddress?: string;
  scope?: ListingQueryScope;
  /** Include full Arkiv payload on each match (browse entire catalog). */
  full?: boolean;
}

export async function catalogQuery(body: CatalogQueryBody) {
  const filters: ListingFilters = {
    tag: body.tag,
    status: body.status as ListingFilters["status"],
    since: body.since,
    until: body.until,
    listingKey: body.listingKey as ListingFilters["listingKey"],
    skillSlug: body.skillSlug,
    scope: body.scope ?? (body.ownerAddress ? "mine" : "marketplace"),
    ownerAddress: body.ownerAddress as ListingFilters["ownerAddress"],
    createdByAddress: body.createdByAddress as ListingFilters["createdByAddress"],
    full: body.full,
  };
  const matches = await searchNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function catalogGetSkill(skillName: string) {
  return fetchSkillListingFromArkiv(skillName);
}

/** Full listing: metadata, purchase, ops, tags, version, owner/creator. */
export async function catalogGetSkillDetail(skillName: string) {
  return fetchSkillCatalogDetail(skillName);
}

export async function catalogStats(scope: ListingQueryScope = "marketplace", ownerAddress?: string) {
  return getCatalogStats({ scope, ownerAddress: ownerAddress as ListingFilters["ownerAddress"] });
}

export async function catalogQueryTraining(body: CatalogQueryBody) {
  const filters: ListingFilters = {
    tag: body.tag,
    status: body.status as ListingFilters["status"],
    since: body.since,
    until: body.until,
    listingKey: body.listingKey as ListingFilters["listingKey"],
    skillSlug: body.skillSlug,
    scope: body.scope ?? (body.ownerAddress ? "mine" : "marketplace"),
    ownerAddress: body.ownerAddress as ListingFilters["ownerAddress"],
    createdByAddress: body.createdByAddress as ListingFilters["createdByAddress"],
    full: body.full,
  };
  const matches = await searchTrainingNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function catalogGetTrainingDetail(skillName: string) {
  const rows = await fetchTrainingListings({ skillSlug: skillName, limit: 1 });
  if (!rows.length) {
    throw new Error(`No training data listing for "${skillName}"`);
  }
  const row = rows[0];
  const tags = await fetchTagsForListing(row.entityKey as `0x${string}`);
  return {
    entityKey: row.entityKey,
    payload: row.payload,
    status: row.status,
    owner: row.owner,
    creator: row.creator,
    tags,
  };
}
