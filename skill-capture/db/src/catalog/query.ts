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

const DEFAULT_MARKETPLACE_LIMIT = 200;
const SEARCH_STOP = new Set([
  "a", "an", "the", "and", "or", "for", "to", "in", "on", "with", "using", "need", "i",
]);

export function normalizeListingFilters(filters: ListingFilters = {}): ListingFilters {
  const scope = filters.scope ?? (filters.ownerAddress ? "mine" : "marketplace");
  const status =
    filters.status ??
    (scope === "marketplace" && !filters.createdByAddress
      ? (LISTING_STATUS.published as ListingStatus)
      : undefined);
  const limit =
    filters.limit ??
    (scope === "marketplace" && !filters.listingKey ? DEFAULT_MARKETPLACE_LIMIT : undefined);
  return { ...filters, scope, status, limit };
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

export function tokenizeSearchQuery(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !SEARCH_STOP.has(t));
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function applySearchPrefilter<T extends { or: (expr: string) => T }>(
  q: T,
  query: string,
): T {
  const tokens = tokenizeSearchQuery(query);
  for (const token of tokens) {
    const t = escapeIlike(token);
    q = q.or(
      `title.ilike.%${t}%,description.ilike.%${t}%,search_text.ilike.%${t}%,skill_slug.ilike.%${t}%`,
    );
  }
  return q;
}

function scoreSearch(query: string, row: CatalogListingRow, tags: string[] = []): number {
  const qTokens = tokenizeSearchQuery(query);
  if (!qTokens.length) return 0;

  const weightedFields: Array<{ text: string; weight: number }> = [
    { text: row.title, weight: 3 },
    { text: row.skill_slug, weight: 2.5 },
    { text: row.description, weight: 2 },
    { text: tags.join(" "), weight: 2 },
    { text: row.search_text, weight: 1 },
  ];

  let totalWeight = 0;
  let earned = 0;
  for (const token of qTokens) {
    let best = 0;
    for (const field of weightedFields) {
      const hay = field.text.toLowerCase();
      if (hay.includes(token)) {
        best = Math.max(best, field.weight);
      }
    }
    if (best > 0) earned += best;
    totalWeight += 3;
  }
  return totalWeight > 0 ? earned / totalWeight : 0;
}

async function selectListings(
  contentKind: "skill" | "trainingData",
  filters: ListingFilters,
  query?: string,
): Promise<CatalogListingRow[]> {
  const f = normalizeListingFilters(filters);

  if (f.tag) {
    const tagIds = await listingIdsForTag(f.tag, f);
    if (!tagIds.length) return [];
    if (f.listingKey && !tagIds.includes(String(f.listingKey))) return [];
  }

  let q = getSupabaseAdmin()
    .from("catalog_listings")
    .select("*")
    .eq("content_kind", contentKind)
    .order("published_at_ms", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (f.skillSlug) q = q.ilike("skill_slug", escapeIlike(f.skillSlug.trim()));
  if (f.since) q = q.gte("published_at_ms", f.since);
  if (f.until) q = q.lte("published_at_ms", f.until);
  if (f.listingKey) q = q.eq("id", String(f.listingKey));
  if (f.tag) {
    const tagIds = await listingIdsForTag(f.tag, f);
    q = q.in("id", tagIds);
  }
  if (query?.trim()) q = applySearchPrefilter(q, query);
  q = applyWalletFilter(q, f, f.createdByAddress ? "creator_wallet" : "owner_wallet");
  if (f.limit) q = q.limit(f.limit);

  const { data, error } = await q;
  if (error) throw new DbError("DB_ERROR", error.message);
  return (data ?? []) as CatalogListingRow[];
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
  filters: Pick<ListingFilters, "scope" | "ownerAddress" | "createdByAddress"> = {},
): Promise<string[]> {
  const normalized = tag.toLowerCase().trim();
  if (!normalized) return [];

  const { data, error } = await getSupabaseAdmin()
    .from("catalog_listing_tags")
    .select("listing_id")
    .eq("tag", normalized);
  if (error) throw new DbError("DB_ERROR", error.message);

  let ids = (data ?? []).map((r) => r.listing_id as string);
  if (!ids.length) return [];

  if (filters.scope === "mine" && filters.ownerAddress) {
    const owner = normalizeWalletAddress(String(filters.ownerAddress));
    const { data: listings, error: listErr } = await getSupabaseAdmin()
      .from("catalog_listings")
      .select("id")
      .in("id", ids)
      .eq("owner_wallet", owner);
    if (listErr) throw new DbError("DB_ERROR", listErr.message);
    ids = (listings ?? []).map((r) => r.id);
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

function rowToMatch(row: CatalogListingRow, score: number): QueryMatch {
  const payload = payloadFromRow(row) as SkillListingPayload;
  return {
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
  };
}

async function enrichMatch(
  match: QueryMatch,
  row: CatalogListingRow,
  filters: ListingFilters,
  contentKind: "skill" | "trainingData",
) {
  if (!filters.full) return;
  const payload =
    contentKind === "trainingData"
      ? TrainingDataListingPayloadSchema.parse(payloadFromRow(row))
      : SkillListingPayloadSchema.parse(payloadFromRow(row));
  match.payload = payload;
  match.tags = await fetchTagsForListing(row.id);
}

async function searchListings(
  contentKind: "skill" | "trainingData",
  query: string,
  filters: ListingFilters,
): Promise<QueryMatch[]> {
  const trimmed = query.trim();
  const rows = await selectListings(contentKind, normalizeListingFilters(filters), trimmed);
  const tagCache = new Map<string, string[]>();

  const scored = await Promise.all(
    rows.map(async (row) => {
      let tags: string[] = [];
      if (trimmed) {
        tags = tagCache.get(row.id) ?? (await fetchTagsForListing(row.id));
        tagCache.set(row.id, tags);
      }
      return {
        row,
        score: trimmed ? scoreSearch(trimmed, row, tags) : 1,
      };
    }),
  );

  if (trimmed) {
    scored.sort((a, b) => b.score - a.score || b.row.published_at_ms - a.row.published_at_ms);
    const withHits = scored.filter((s) => s.score > 0);
    if (withHits.length) {
      scored.length = 0;
      scored.push(...withHits);
    }
  }

  const matches: QueryMatch[] = [];
  for (const { row, score } of scored) {
    const match = rowToMatch(row, score);
    await enrichMatch(match, row, filters, contentKind);
    matches.push(match);
  }
  return matches;
}

export async function searchNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  return searchListings("skill", query, filters);
}

export async function searchTrainingNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  return searchListings("trainingData", query, filters);
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
  trainingListing?: number;
}> {
  const f = normalizeListingFilters(filters);
  let listingQ = getSupabaseAdmin()
    .from("catalog_listings")
    .select("id", { count: "exact", head: true })
    .eq("content_kind", "skill");
  listingQ = applyWalletFilter(listingQ, f, "owner_wallet");
  const { count: skillListing } = await listingQ;

  let trainingQ = getSupabaseAdmin()
    .from("catalog_listings")
    .select("id", { count: "exact", head: true })
    .eq("content_kind", "trainingData");
  trainingQ = applyWalletFilter(trainingQ, f, "owner_wallet");
  const { count: trainingListing } = await trainingQ;

  const { count: skillTag } = await getSupabaseAdmin()
    .from("catalog_listing_tags")
    .select("id", { count: "exact", head: true });

  const { count: listingVersion } = await getSupabaseAdmin()
    .from("catalog_listing_versions")
    .select("id", { count: "exact", head: true });

  const totalEntities =
    (skillListing ?? 0) + (trainingListing ?? 0) + (skillTag ?? 0) + (listingVersion ?? 0);
  return {
    totalEntities,
    skillListing: skillListing ?? 0,
    trainingListing: trainingListing ?? 0,
    skillTag: skillTag ?? 0,
    listingVersion: listingVersion ?? 0,
  };
}
