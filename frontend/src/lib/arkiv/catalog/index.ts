/**
 * Skill + training catalog reads on Arkiv Braga — direct @arkiv-network/sdk.
 */
import type { Hex } from "viem";
import { fetchSkillListingFromArkiv } from "./cdr-listing";
import { fetchSkillCatalogDetail, fetchTrainingCatalogDetail } from "./detail";
import {
  getCatalogStats as getCatalogStatsQuery,
  searchNaturalLanguage,
  searchTrainingNaturalLanguage,
  type ListingFilters,
  type ListingQueryScope,
} from "./query";

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

export type CatalogDetailParams = {
  ownerAddress?: string;
  listingKey?: string;
  kind?: "skill" | "training";
};

function toListingFilters(body: CatalogQueryBody): ListingFilters {
  return {
    tag: body.tag,
    status: body.status,
    since: body.since,
    until: body.until,
    listingKey: body.listingKey as Hex | undefined,
    skillSlug: body.skillSlug,
    scope: body.scope ?? (body.ownerAddress ? "mine" : "marketplace"),
    ownerAddress: body.ownerAddress as Hex | undefined,
    createdByAddress: body.createdByAddress as Hex | undefined,
    full: body.full,
  };
}

export async function queryCatalog(body: CatalogQueryBody) {
  const filters = toListingFilters(body);
  const matches = await searchNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function queryCatalogTraining(body: CatalogQueryBody) {
  const filters = toListingFilters(body);
  const matches = await searchTrainingNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function getCatalogSkill(skillName: string) {
  return fetchSkillListingFromArkiv(skillName);
}

export async function getCatalogSkillDetail(skillName: string, params?: CatalogDetailParams) {
  const scope = {
    ownerAddress: params?.ownerAddress as Hex | undefined,
    listingKey: params?.listingKey as Hex | undefined,
  };
  if (params?.kind === "training") {
    return fetchTrainingCatalogDetail(skillName, scope);
  }
  return fetchSkillCatalogDetail(skillName, scope);
}

export async function getCatalogStats(scope: ListingQueryScope = "marketplace", ownerAddress?: string) {
  return getCatalogStatsQuery({
    scope,
    ownerAddress: ownerAddress as Hex | undefined,
  });
}
