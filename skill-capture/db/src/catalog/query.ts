import type { Hex } from "viem";
import { getSupabaseAdmin, normalizeWalletAddress } from "../client.js";
import { DbError } from "../errors.js";
import { getDeviceWalletAddress } from "../device-wallet.js";
import { LISTING_STATUS, type ListingStatus } from "../constants.js";
import {
  SkillListingPayloadSchema,
  TrainingDataListingPayloadSchema,
  type QueryMatch,
  type PurchaseInfo,
  type SkillListingPayload,
  type TrainingDataListingPayload,
} from "../types.js";
import {
  type CatalogListingRow,
  payloadFromRow,
  purchaseFromRow,
} from "./row-mapper.js";

export type ListingQueryScope = "marketplace" | "mine";

export interface ListingFilters {
  status?: ListingStatus;
  since?: number;
  until?: number;
  tag?: string;
  listingKey?: Hex | string;
  skillSlug?: string;
  limit?: number;
  ownerAddress?: Hex | string;
  createdByAddress?: Hex | string;
  scope?: ListingQueryScope;
  full?: boolean;
}

export function normalizeListingFilters(filters: ListingFilters = {}): ListingFilters {
  const scope = filters.scope ?? (filters.ownerAddress ? "mine" : "marketplace");
  const status =
    filters.status ??
    (scope === "marketplace" && !filters.createdByAddress
      ? (LISTING_STATUS.published as ListingStatus)
      : undefined);
  return { ...filters, scope, status };
}

function applyWalletFilter(
  q: ReturnType<ReturnType<typeof getSupabaseAdmin>["from"]>,
  filters: ListingFilters,
  col: "owner_wallet" | "creator_wallet",
) {
  if (filters.createdByAddress) {
    return q.eq(col, normalizeWalletAddress(String(filters.createdByAddress)));
  }
  const scope = filters.scope ?? (filters.ownerAddress ? "mine" : "marketplace");
  if (scope === "mine") {
    const owner = normalizeWalletAddress(
      String(filters.ownerAddress ?? getDeviceWalletAddress()),
    );
    return q.eq("owner_wallet", owner);
  }
  return q;
}

async function selectListings(
  contentKind: "skill" | "trainingData",
  filters: ListingFilters,
): Promise<CatalogListingRow[]> {
  const f = normalizeListingFilters(filters);
  let q = getSupabaseAdmin()
    .from("catalog_listings")
    .select("*")
    .eq("content_kind", contentKind)
    .order("published_at_ms", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (f.skillSlug) q = q.ilike("skill_slug", f.skillSlug);
  if (f.since) q = q.gte("published_at_ms", f.since);
  if (f.until) q = q.lte("published_at_ms", f.until);
  if (f.listingKey) q = q.eq("id", String(f.listingKey));
  q = applyWalletFilter(q, f, f.createdByAddress ? "creator_wallet" : "owner_wallet");
  if (f.limit) q = q.limit(f.limit);

  const { data, error } = await q;
  if (error) throw new DbError("DB_ERROR", error.message);
  let rows = (data ?? []) as CatalogListingRow[];

  if (f.tag) {
    const keys = await listingIdsForTag(f.tag, f);
    const set = new Set(keys);
    rows = rows.filter((r) => set.has(r.id));
  }

  return rows;
}

export async function fetchListings(filters: ListingFilters = {}): Promise<
  Array<{
    entityKey: string;
    listingId: string;
    status: string;
    version: number;
    payload: SkillListingPayload;
    owner?: string;
    creator?: string;
  }>
> {
  const rows = await selectListings("skill", filters);
  return rows.map((row) => ({
    entityKey: row.id,
    listingId: row.id,
    status: row.status,
    version: row.version,
    payload: SkillListingPayloadSchema.parse(payloadFromRow(row)),
    owner: row.owner_wallet,
    creator: row.creator_wallet,
  }));
}

export async function fetchTrainingListings(filters: ListingFilters = {}): Promise<
  Array<{
    entityKey: string;
    listingId: string;
    status: string;
    version: number;
    payload: TrainingDataListingPayload;
    owner?: string;
    creator?: string;
  }>
> {
  const rows = await selectListings("trainingData", filters);
  return rows.map((row) => ({
    entityKey: row.id,
    listingId: row.id,
    status: row.status,
    version: row.version,
    payload: TrainingDataListingPayloadSchema.parse(payloadFromRow(row)),
    owner: row.owner_wallet,
    creator: row.creator_wallet,
  }));
}

export async function listingIdsForTag(
  tag: string,
  filters: Pick<ListingFilters, "scope" | "ownerAddress"> = {},
): Promise<string[]> {
  const normalized = tag.toLowerCase();
  let q = getSupabaseAdmin()
    .from("catalog_listing_tags")
    .select("listing_id")
    .eq("tag", normalized);
  const { data, error } = await q;
  if (error) throw new DbError("DB_ERROR", error.message);
  const ids = (data ?? []).map((r) => r.listing_id as string);
  if (!ids.length) return [];
  if (filters.scope === "mine" && filters.ownerAddress) {
    const owner = normalizeWalletAddress(String(filters.ownerAddress));
    const { data: listings } = await getSupabaseAdmin()
      .from("catalog_listings")
      .select("id")
      .in("id", ids)
      .eq("owner_wallet", owner);
    return (listings ?? []).map((r) => r.id);
  }
  return ids;
}

export async function fetchTagsForListing(listingId: string): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("catalog_listing_tags")
    .select("tag")
    .eq("listing_id", listingId);
  if (error) throw new DbError("DB_ERROR", error.message);
  return (data ?? []).map((r) => r.tag as string);
}

const STOP = new Set([
  "a", "an", "the", "and", "or", "for", "to", "in", "on", "with", "using", "need", "i",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function scoreSearch(query: string, searchText: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const hay = searchText.toLowerCase();
  let hits = 0;
  for (const t of qTokens) {
    if (hay.includes(t)) hits++;
  }
  return hits / qTokens.length;
}

function rowToMatch(
  row: CatalogListingRow,
  score: number,
  filters: ListingFilters,
): QueryMatch {
  const payload = payloadFromRow(row) as SkillListingPayload;
  const match: QueryMatch = {
    score,
    listingId: row.id,
    entityKey: row.id,
    skillName: payload.skillName,
    title: payload.title,
    description: payload.description,
    triggers: "triggers" in payload ? (payload.triggers ?? []) : [],
    purchase: purchaseFromRow(row),
    listingKey: row.id,
    status: row.status,
    owner: row.owner_wallet,
    creator: row.creator_wallet,
    catalogVersion: row.version,
    arkivVersion: row.version,
  };
  return match;
}

async function enrichMatch(match: QueryMatch, listingId: string, filters: ListingFilters) {
  if (filters.full) {
    const rows = await fetchListings({ listingKey: listingId, limit: 1 });
    if (rows[0]) {
      match.payload = rows[0].payload;
      match.tags = await fetchTagsForListing(listingId);
    }
  }
}

export async function searchNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  const rows = await selectListings("skill", normalizeListingFilters(filters));
  const scored = rows.map((row) => ({
    row,
    score: query.trim() ? scoreSearch(query, row.search_text) : 1,
  }));

  if (query.trim()) {
    scored.sort((a, b) => b.score - a.score);
    const withHits = scored.filter((s) => s.score > 0);
    if (withHits.length) {
      scored.length = 0;
      scored.push(...withHits);
    }
  }

  const matches: QueryMatch[] = [];
  for (const { row, score } of scored) {
    const match = rowToMatch(row, score, filters);
    await enrichMatch(match, row.id, filters);
    matches.push(match);
  }
  return matches;
}

export async function searchTrainingNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  const rows = await selectListings("trainingData", normalizeListingFilters(filters));
  const scored = rows.map((row) => ({
    row,
    score: query.trim() ? scoreSearch(query, row.search_text) : 1,
  }));

  if (query.trim()) {
    scored.sort((a, b) => b.score - a.score);
    const withHits = scored.filter((s) => s.score > 0);
    if (withHits.length) {
      scored.length = 0;
      scored.push(...withHits);
    }
  }

  const matches: QueryMatch[] = [];
  for (const { row, score } of scored) {
    const match = rowToMatch(row, score, filters);
    await enrichMatch(match, row.id, filters);
    matches.push(match);
  }
  return matches;
}

export async function getNextVersionNumber(listingId: string): Promise<number> {
  const { data, error } = await getSupabaseAdmin()
    .from("catalog_listing_versions")
    .select("version")
    .eq("listing_id", listingId)
    .order("version", { ascending: false })
    .limit(1);
  if (error) throw new DbError("DB_ERROR", error.message);
  const max = data?.[0]?.version ?? 0;
  return max + 1;
}

export async function getCatalogStats(
  filters: Pick<ListingFilters, "scope" | "ownerAddress"> = { scope: "marketplace" },
): Promise<{
  totalEntities: number;
  skillListing: number;
  skillTag: number;
  listingVersion: number;
}> {
  const f = normalizeListingFilters(filters);
  let listingQ = getSupabaseAdmin()
    .from("catalog_listings")
    .select("id", { count: "exact", head: true })
    .eq("content_kind", "skill");
  listingQ = applyWalletFilter(listingQ, f, "owner_wallet");
  const { count: skillListing } = await listingQ;

  let tagQ = getSupabaseAdmin()
    .from("catalog_listing_tags")
    .select("id", { count: "exact", head: true });
  const { count: skillTag } = await tagQ;

  let verQ = getSupabaseAdmin()
    .from("catalog_listing_versions")
    .select("id", { count: "exact", head: true });
  const { count: listingVersion } = await verQ;

  const totalEntities = (skillListing ?? 0) + (skillTag ?? 0) + (listingVersion ?? 0);
  return {
    totalEntities,
    skillListing: skillListing ?? 0,
    skillTag: skillTag ?? 0,
    listingVersion: listingVersion ?? 0,
  };
}
