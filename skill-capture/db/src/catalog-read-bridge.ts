import { loadDbEnv } from "./env.js";
import {
  fetchSkillCatalogDetail,
  fetchTrainingCatalogDetail,
  type CatalogDetailScope,
} from "./catalog/detail.js";
import { fetchSkillListingFromCatalog } from "./catalog/cdr-listing.js";
import {
  getCatalogStats,
  searchNaturalLanguage,
  searchTrainingNaturalLanguage,
  type ListingFilters,
  type ListingQueryScope,
} from "./catalog/query.js";

loadDbEnv();

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
  return fetchSkillListingFromCatalog(skillName);
}

export async function catalogGetSkillDetail(
  skillName: string,
  ownerAddress?: string,
  listingKey?: string,
) {
  const scope: CatalogDetailScope = {
    ownerAddress: ownerAddress as CatalogDetailScope["ownerAddress"],
    listingKey: listingKey as CatalogDetailScope["listingKey"],
  };
  return fetchSkillCatalogDetail(skillName, scope);
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

export async function catalogGetTrainingDetail(
  skillName: string,
  ownerAddress?: string,
  listingKey?: string,
) {
  const scope: CatalogDetailScope = {
    ownerAddress: ownerAddress as CatalogDetailScope["ownerAddress"],
    listingKey: listingKey as CatalogDetailScope["listingKey"],
  };
  return fetchTrainingCatalogDetail(skillName, scope);
}
