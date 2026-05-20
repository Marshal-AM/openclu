import { eq, and, gte, lte, desc } from "@arkiv-network/sdk/query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { createArkivPublicClient, getCreatorWallet } from "../lib/client.js";
import {
  ATTR,
  ENTITY_TYPE,
  PROJECT_ATTRIBUTE,
  type ListingStatus,
} from "../lib/constants.js";
import {
  SkillListingPayloadSchema,
  SkillTagPayloadSchema,
  type QueryMatch,
  type PurchaseInfo,
} from "../lib/types.js";

export type ListingQueryScope = "marketplace" | "mine";

export interface ListingFilters {
  status?: ListingStatus;
  since?: number;
  until?: number;
  tag?: string;
  listingKey?: Hex;
  skillSlug?: string;
  limit?: number;
  /** Filter by Arkiv $owner (device wallet). */
  ownerAddress?: Hex;
  scope?: ListingQueryScope;
}

function applyWalletScope<T extends { ownedBy: (a: Hex) => T; createdBy: (a: Hex) => T }>(
  qb: T,
  filters: ListingFilters,
): T {
  const scope = filters.scope ?? (filters.ownerAddress ? "mine" : "marketplace");
  if (scope === "mine") {
    const owner = (filters.ownerAddress ?? getCreatorWallet()) as Hex;
    return qb.ownedBy(owner);
  }
  return qb;
}

function listingQueryBuilder(filters: ListingFilters = {}) {
  const preds = [
    eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
    eq(ATTR.entityType, ENTITY_TYPE.skillListing),
  ];
  if (filters.status) preds.push(eq(ATTR.status, filters.status));
  if (filters.skillSlug) preds.push(eq(ATTR.skillSlug, filters.skillSlug));
  if (filters.since) preds.push(gte(ATTR.publishedAt, filters.since));
  if (filters.until) preds.push(lte(ATTR.publishedAt, filters.until));

  let qb = createArkivPublicClient()
    .buildQuery()
    .where(and(preds))
    .withPayload(true)
    .withAttributes(true)
    .orderBy(desc(ATTR.publishedAt, "number"));

  qb = applyWalletScope(qb, filters);
  if (filters.limit) qb = qb.limit(filters.limit);
  return qb;
}

function parseListingEntity(entity: Entity): {
  payload: ReturnType<typeof SkillListingPayloadSchema.parse>;
  entityKey: string;
  status: string;
} {
  const raw = entity.toJson();
  const payload = SkillListingPayloadSchema.parse(raw);
  const statusAttr = entity.attributes.find((a) => a.key === ATTR.status);
  return {
    payload,
    entityKey: entity.key,
    status: String(statusAttr?.value ?? "published"),
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

export async function fetchListings(filters: ListingFilters = {}): Promise<
  Array<{
    entityKey: string;
    status: string;
    payload: ReturnType<typeof SkillListingPayloadSchema.parse>;
  }>
> {
  const qb = listingQueryBuilder(filters);
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
        eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
        eq(ATTR.entityType, ENTITY_TYPE.skillTag),
        eq(ATTR.tag, normalized),
      ]),
    )
    .withAttributes(true);
  qb = applyWalletScope(qb, { scope: filters.scope ?? "marketplace", ownerAddress: filters.ownerAddress });

  const entities = await fetchAllPages(qb);
  const keys = new Set<string>();
  for (const e of entities) {
    const attr = e.attributes.find((a) => a.key === ATTR.listingKey);
    if (attr) keys.add(String(attr.value));
  }
  return [...keys];
}

export async function fetchTagsForListing(listingKey: Hex): Promise<string[]> {
  const qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
        eq(ATTR.entityType, ENTITY_TYPE.skillTag),
        eq(ATTR.listingKey, listingKey),
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
  const rows = await fetchListings(filters);
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
    matches.push({
      score,
      entityKey: row.entityKey,
      skillName: row.payload.skillName,
      title: row.payload.title,
      description: row.payload.description,
      triggers: row.payload.triggers ?? [],
      purchase: row.payload.purchase as PurchaseInfo,
      listingKey: row.entityKey,
      status: row.status,
    });
  }
  return matches;
}

export async function findListingBySkillSlug(skillSlug: string): Promise<{
  entityKey: Hex;
  version: number;
} | null> {
  const rows = await fetchListings({ skillSlug, limit: 1 });
  if (!rows.length) return null;
  const manifestVersion = 0;
  return { entityKey: rows[0].entityKey as Hex, version: manifestVersion };
}

export async function fetchTagEntityKeysForListing(listingKey: Hex): Promise<Hex[]> {
  const qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
        eq(ATTR.entityType, ENTITY_TYPE.skillTag),
        eq(ATTR.listingKey, listingKey),
      ]),
    );

  const entities = await fetchAllPages(qb);
  return entities.map((e) => e.key);
}

export async function getNextVersionNumber(listingKey: Hex): Promise<number> {
  const qb = createArkivPublicClient()
    .buildQuery()
    .where(
      and([
        eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
        eq(ATTR.entityType, ENTITY_TYPE.listingVersion),
        eq(ATTR.listingKey, listingKey),
      ]),
    )
    .withAttributes(true);

  const entities = await fetchAllPages(qb);
  let max = 0;
  for (const e of entities) {
    const v = e.attributes.find((a) => a.key === ATTR.version);
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
          eq(PROJECT_ATTRIBUTE.key, PROJECT_ATTRIBUTE.value),
          eq(ATTR.entityType, entityType),
        ]),
      );
    qb = applyWalletScope(qb, filters);
    return qb.count();
  }

  const [skillListing, skillTag, listingVersion] = await Promise.all([
    countType(ENTITY_TYPE.skillListing),
    countType(ENTITY_TYPE.skillTag),
    countType(ENTITY_TYPE.listingVersion),
  ]);

  return { totalEntities, skillListing, skillTag, listingVersion };
}
