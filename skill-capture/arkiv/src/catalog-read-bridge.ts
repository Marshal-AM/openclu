/**
 * Server-only catalog reads for Next.js (public client — no private key).
 */
import { loadArkivEnv } from "./lib/env.js";
import { fetchSkillListingFromArkiv } from "./lib/cdr-listing.js";
import {
  getCatalogStats,
  searchNaturalLanguage,
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
  scope?: ListingQueryScope;
}

export async function catalogQuery(body: CatalogQueryBody) {
  const filters: ListingFilters = {
    tag: body.tag,
    status: body.status,
    since: body.since,
    until: body.until,
    listingKey: body.listingKey as ListingFilters["listingKey"],
    skillSlug: body.skillSlug,
    scope: body.scope ?? (body.ownerAddress ? "mine" : "marketplace"),
    ownerAddress: body.ownerAddress as ListingFilters["ownerAddress"],
  };
  const matches = await searchNaturalLanguage(body.query ?? "", filters);
  const minScore = body.minScore ?? 0;
  const filtered = matches.filter((m) => m.score >= minScore);
  return { matchCount: filtered.length, matches: filtered, filters };
}

export async function catalogGetSkill(skillName: string) {
  return fetchSkillListingFromArkiv(skillName);
}

export async function catalogStats(scope: ListingQueryScope = "marketplace", ownerAddress?: string) {
  return getCatalogStats({ scope, ownerAddress: ownerAddress as ListingFilters["ownerAddress"] });
}
