import {
  fetchSkillCatalogDetail,
  fetchTrainingCatalogDetail,
  type CatalogDetailScope,
} from "./db/catalog/detail";
import { fetchSkillListingFromCatalog } from "./db/catalog/cdr-listing";
import {
  getCatalogStats as fetchCatalogStats,
  searchNaturalLanguage,
  searchTrainingNaturalLanguage,
  type ListingFilters,
  type ListingQueryScope,
} from "./db/catalog/query";

export type CatalogQueryBody = {
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
};

function toFilters(body: CatalogQueryBody): ListingFilters {
  return {
    tag: body.tag,
    status: body.status,
    since: body.since,
    until: body.until,
    listingKey: body.listingKey as ListingFilters["listingKey"],
    skillSlug: body.skillSlug,
    scope: body.scope ?? (body.ownerAddress ? "mine" : "marketplace"),
    ownerAddress: body.ownerAddress as ListingFilters["ownerAddress"],
    createdByAddress: body.createdByAddress as ListingFilters["createdByAddress"],
    full: body.full,
  };
}

export async function queryCatalog(body: CatalogQueryBody) {
  const filters = toFilters(body);
  const matches = await searchNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function queryCatalogTraining(body: CatalogQueryBody) {
  const filters = toFilters(body);
  const matches = await searchTrainingNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function getCatalogSkill(skillName: string) {
  return fetchSkillListingFromCatalog(skillName);
}

export async function getCatalogSkillDetail(
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

export async function getCatalogTrainingDetail(
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

export async function getCatalogStats(
  scope: ListingQueryScope = "marketplace",
  ownerAddress?: string,
) {
  return fetchCatalogStats({
    scope,
    ownerAddress: ownerAddress as ListingFilters["ownerAddress"],
  });
}
