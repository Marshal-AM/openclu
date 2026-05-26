import { eq, and, gte, lte, desc } from "@arkiv-network/sdk/query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { createArkivPublicClient } from "@/lib/arkiv/client";
import { ArkivError } from "@/lib/arkiv/errors";
import {
  CATALOG_ATTR,
  CATALOG_ENTITY_TYPE,
  CATALOG_PROJECT_ATTRIBUTE,
  LISTING_STATUS,
  type ListingStatus,
} from "./constants";
import {
  SkillListingPayloadSchema,
  SkillTagPayloadSchema,
  TrainingDataListingPayloadSchema,
  type PurchaseInfo,
  type QueryMatch,
  type SkillListingPayload,
} from "./types";

export type ListingQueryScope = "marketplace" | "mine";

export interface ListingFilters {
  status?: ListingStatus;
  since?: number;
  until?: number;
  tag?: string;
  listingKey?: Hex;
  skillSlug?: string;
  limit?: number;
  ownerAddress?: Hex;
  createdByAddress?: Hex;
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

function applyWalletScope<T extends { ownedBy: (a: Hex) => T; createdBy: (a: Hex) => T }>(
  qb: T,
  filters: ListingFilters,
): T {
  if (filters.createdByAddress) {
    return qb.createdBy(filters.createdByAddress);
  }
  const scope = filters.scope ?? (filters.ownerAddress ? "mine" : "marketplace");
  if (scope === "mine") {
    if (!filters.ownerAddress) {
      throw new ArkivError(
        "CONFIG_MISSING",
        "ownerAddress required for scope=mine catalog queries",
      );
    }
    return qb.ownedBy(filters.ownerAddress);
  }
  return qb;
}

function entityWalletMeta(entity: Entity): { owner?: string; creator?: string } {
  const e = entity as Entity & {
    owner?: Hex;
    creator?: Hex;
    metadata?: { owner?: Hex; creator?: Hex };
  };
  const owner = e.owner ?? e.metadata?.owner;
  const creator = e.creator ?? e.metadata?.creator;
  return {
    owner: owner ? String(owner) : undefined,
    creator: creator ? String(creator) : undefined,
  };
}

function listingQueryBuilder(filters: ListingFilters = {}) {
  const preds = [
    eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
    eq(CATALOG_ATTR.entityType, CATALOG_ENTITY_TYPE.skillListing),
  ];
  if (filters.status) preds.push(eq(CATALOG_ATTR.status, filters.status));
  if (filters.skillSlug) preds.push(eq(CATALOG_ATTR.skillSlug, filters.skillSlug));
  if (filters.since) preds.push(gte(CATALOG_ATTR.publishedAt, filters.since));
  if (filters.until) preds.push(lte(CATALOG_ATTR.publishedAt, filters.until));

  let qb = createArkivPublicClient()
    .buildQuery()
    .where(and(preds))
    .withPayload(true)
    .withAttributes(true)
    .withMetadata(true)
    .orderBy(desc(CATALOG_ATTR.publishedAt, "number"));

  qb = applyWalletScope(qb, filters);
  if (filters.limit) qb = qb.limit(filters.limit);
  return qb;
}

function parseListingEntity(entity: Entity) {
  const raw = entity.toJson();
  const payload = SkillListingPayloadSchema.parse(raw);
  const statusAttr = entity.attributes.find((a) => a.key === CATALOG_ATTR.status);
  const wallet = entityWalletMeta(entity);
  return {
    payload,
    entityKey: entity.key,
    status: String(statusAttr?.value ?? "published"),
    owner: wallet.owner,
    creator: wallet.creator,
  };
}

type ArkivListingQuery = ReturnType<ReturnType<typeof createArkivPublicClient>["buildQuery"]>;

export async function fetchAllPages(builder: ArkivListingQuery): Promise<Entity[]> {
  const limit = 200;
  const qb = builder.limit(limit);
  const result = await qb.fetch();
  const out = [...result.entities];
  let page = result;
  while (page.hasNextPage()) {
    await page.next();
    out.push(...page.entities);
    page = page;
  }
  return out;
}

export async function fetchListings(filters: ListingFilters = {}) {
  const qb = listingQueryBuilder(normalizeListingFilters(filters));
  const entities = await fetchAllPages(qb);
  let rows = entities.map(parseListingEntity);

  if (filters.listingKey) {
    rows = rows.filter((r) => r.entityKey.toLowerCase() === filters.listingKey!.toLowerCase());
  }

  if (filters.tag) {
    const keys = await listingKeysForTag(filters.tag, {
      scope: filters.scope,
      ownerAddress: filters.ownerAddress,
    });
    const set = new Set(keys.map((k) => k.toLowerCase()));
    rows = rows.filter((r) => set.has(r.entityKey.toLowerCase()));
  }

  return rows;
}

export async function listingKeysForTag(
  tag: string,
  filters: Pick<ListingFilters, "scope" | "ownerAddress"> = {},
): Promise<string[]> {
  const normalized = tag.toLowerCase();
  let qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
        eq(CATALOG_ATTR.entityType, CATALOG_ENTITY_TYPE.skillTag),
        eq(CATALOG_ATTR.tag, normalized),
      ]),
    )
    .withAttributes(true);
  qb = applyWalletScope(qb, { scope: filters.scope ?? "marketplace", ownerAddress: filters.ownerAddress });

  const entities = await fetchAllPages(qb);
  const keys = new Set<string>();
  for (const e of entities) {
    const attr = e.attributes.find((a) => a.key === CATALOG_ATTR.listingKey);
    if (attr) keys.add(String(attr.value));
  }
  return [...keys];
}

export async function fetchTagsForListing(listingKey: Hex): Promise<string[]> {
  const qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
        eq(CATALOG_ATTR.entityType, CATALOG_ENTITY_TYPE.skillTag),
        eq(CATALOG_ATTR.listingKey, listingKey),
      ]),
    )
    .withPayload(true);

  const entities = await fetchAllPages(qb);
  return entities.map((e) => SkillTagPayloadSchema.parse(e.toJson()).tag);
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

export async function searchNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  const rows = await fetchListings(normalizeListingFilters(filters));
  const scored = rows.map((row) => ({
    row,
    score: query.trim() ? scoreSearch(query, row.payload.searchText) : 1,
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
    const match: QueryMatch = {
      score,
      entityKey: row.entityKey,
      skillName: row.payload.skillName,
      title: row.payload.title,
      description: row.payload.description,
      triggers: row.payload.triggers ?? [],
      purchase: row.payload.purchase as PurchaseInfo,
      listingKey: row.entityKey,
      status: row.status,
      owner: row.owner,
      creator: row.creator,
    };
    if (filters.full) {
      match.payload = row.payload;
      const listingKey = row.entityKey as Hex;
      const next = await getNextVersionNumber(listingKey);
      match.arkivVersion = Math.max(1, next - 1);
      match.tags = await fetchTagsForListing(listingKey);
    }
    matches.push(match);
  }
  return matches;
}

function trainingListingQueryBuilder(filters: ListingFilters = {}) {
  const preds = [
    eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
    eq(CATALOG_ATTR.entityType, CATALOG_ENTITY_TYPE.trainingDataListing),
  ];
  if (filters.status) preds.push(eq(CATALOG_ATTR.status, filters.status));
  if (filters.skillSlug) preds.push(eq(CATALOG_ATTR.skillSlug, filters.skillSlug));
  if (filters.since) preds.push(gte(CATALOG_ATTR.publishedAt, filters.since));
  if (filters.until) preds.push(lte(CATALOG_ATTR.publishedAt, filters.until));

  let qb = createArkivPublicClient()
    .buildQuery()
    .where(and(preds))
    .withPayload(true)
    .withAttributes(true)
    .withMetadata(true)
    .orderBy(desc(CATALOG_ATTR.publishedAt, "number"));

  qb = applyWalletScope(qb, filters);
  if (filters.limit) qb = qb.limit(filters.limit);
  return qb;
}

function parseTrainingListingEntity(entity: Entity) {
  const raw = entity.toJson();
  const payload = TrainingDataListingPayloadSchema.parse(raw);
  const statusAttr = entity.attributes.find((a) => a.key === CATALOG_ATTR.status);
  const wallet = entityWalletMeta(entity);
  return {
    payload,
    entityKey: entity.key,
    status: String(statusAttr?.value ?? "published"),
    owner: wallet.owner,
    creator: wallet.creator,
  };
}

export async function fetchTrainingListings(filters: ListingFilters = {}) {
  const qb = trainingListingQueryBuilder(normalizeListingFilters(filters));
  const entities = await fetchAllPages(qb);
  let rows = entities.map(parseTrainingListingEntity);

  if (filters.listingKey) {
    rows = rows.filter((r) => r.entityKey.toLowerCase() === filters.listingKey!.toLowerCase());
  }

  if (filters.tag) {
    const keys = await listingKeysForTag(filters.tag, {
      scope: filters.scope,
      ownerAddress: filters.ownerAddress,
    });
    const set = new Set(keys.map((k) => k.toLowerCase()));
    rows = rows.filter((r) => set.has(r.entityKey.toLowerCase()));
  }

  return rows;
}

export async function searchTrainingNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  const rows = await fetchTrainingListings(normalizeListingFilters(filters));
  const scored = rows.map((row) => ({
    row,
    score: query.trim() ? scoreSearch(query, row.payload.searchText) : 1,
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
    const match: QueryMatch = {
      score,
      entityKey: row.entityKey,
      skillName: row.payload.skillName,
      title: row.payload.title,
      description: row.payload.description,
      triggers: [],
      purchase: row.payload.purchase as PurchaseInfo,
      listingKey: row.entityKey,
      status: row.status,
      owner: row.owner,
      creator: row.creator,
    };
    if (filters.full) {
      match.payload = row.payload as unknown as SkillListingPayload;
      const listingKey = row.entityKey as Hex;
      const next = await getNextVersionNumber(listingKey);
      match.arkivVersion = Math.max(1, next - 1);
      match.tags = await fetchTagsForListing(listingKey);
    }
    matches.push(match);
  }
  return matches;
}

export async function getNextVersionNumber(listingKey: Hex): Promise<number> {
  const qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
        eq(CATALOG_ATTR.entityType, CATALOG_ENTITY_TYPE.listingVersion),
        eq(CATALOG_ATTR.listingKey, listingKey),
      ]),
    )
    .withAttributes(true);

  const entities = await fetchAllPages(qb);
  let max = 0;
  for (const e of entities) {
    const v = e.attributes.find((a) => a.key === CATALOG_ATTR.version);
    const n = typeof v?.value === "number" ? v.value : Number(v?.value ?? 0);
    if (n > max) max = n;
  }
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
  const publicClient = createArkivPublicClient();
  const totalEntities = await publicClient.getEntityCount();

  async function countType(entityType: string): Promise<number> {
    let qb = createArkivPublicClient()
      .buildQuery()
      .where(
        and([
          eq(CATALOG_PROJECT_ATTRIBUTE.key, CATALOG_PROJECT_ATTRIBUTE.value),
          eq(CATALOG_ATTR.entityType, entityType),
        ]),
      );
    qb = applyWalletScope(qb, filters);
    return qb.count();
  }

  const [skillListing, skillTag, listingVersion] = await Promise.all([
    countType(CATALOG_ENTITY_TYPE.skillListing),
    countType(CATALOG_ENTITY_TYPE.skillTag),
    countType(CATALOG_ENTITY_TYPE.listingVersion),
  ]);

  return { totalEntities, skillListing, skillTag, listingVersion };
}
