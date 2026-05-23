import { eq, and, gte, lte, desc } from "@arkiv-network/sdk/query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { createArkivPublicClient, getCreatorWallet } from "../lib/client.js";
import {
  ATTR,
  ENTITY_TYPE,
  LISTING_STATUS,
  PROJECT_ATTRIBUTE,
  type ListingStatus,
} from "../lib/constants.js";
import {
  SkillListingPayloadSchema,
  SkillTagPayloadSchema,
  type QueryMatch,
  type PurchaseInfo,
  type SkillListingPayload,
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
  /** Filter by Arkiv $creator (immutable attribution). */
  createdByAddress?: Hex;
  scope?: ListingQueryScope;
  /** Attach full SkillListingPayload on each match. */
  full?: boolean;
}

/** Marketplace browse defaults to published only; mine keeps all statuses unless set. */
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
    const owner = (filters.ownerAddress ?? getCreatorWallet()) as Hex;
    return qb.ownedBy(owner);
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
    .withMetadata(true)
    .orderBy(desc(ATTR.publishedAt, "number"));

  qb = applyWalletScope(qb, filters);
  if (filters.limit) qb = qb.limit(filters.limit);
  return qb;
}

function parseListingEntity(entity: Entity): {
  payload: ReturnType<typeof SkillListingPayloadSchema.parse>;
  entityKey: string;
  status: string;
  owner?: string;
  creator?: string;
} {
  const raw = entity.toJson();
  const payload = SkillListingPayloadSchema.parse(raw);
  const statusAttr = entity.attributes.find((a) => a.key === ATTR.status);
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

export async function fetchListings(filters: ListingFilters = {}): Promise<
  Array<{
    entityKey: string;
    status: string;
    payload: ReturnType<typeof SkillListingPayloadSchema.parse>;
    owner?: string;
    creator?: string;
  }>
> {
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

  if (filters.since != null || filters.until != null) {
    rows = rows.filter((row) => matchesPublishedAtRange(row.payload, filters.since, filters.until));
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
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function haystackWords(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function tokenMatches(token: string, hay: string, hayWords: string[], slugParts: string[]): boolean {
  if (hay.includes(token)) return true;
  if (hayWords.some((word) => word.startsWith(token) || token.startsWith(word))) return true;
  return slugParts.some((part) => part.includes(token) || token.includes(part));
}

type SearchableListing = {
  searchText: string;
  skillName: string;
  title: string;
  description: string;
};

function scoreSearch(query: string, listing: SearchableListing): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const hay = listing.searchText.toLowerCase();
  const hayWords = haystackWords(hay);
  const slugParts = listing.skillName.toLowerCase().split(/[-_]/).filter(Boolean);
  const titleHay = listing.title.toLowerCase();
  const descriptionHay = listing.description.toLowerCase();

  if (
    hay.includes(q) ||
    titleHay.includes(q) ||
    descriptionHay.includes(q) ||
    listing.skillName.toLowerCase().includes(q)
  ) {
    return 1;
  }

  const qTokens = tokenize(q);
  if (!qTokens.length) {
    return q.length >= 2 && (hay.includes(q) || titleHay.includes(q) || slugParts.some((p) => p.includes(q)))
      ? 0.4
      : 0;
  }

  let hits = 0;
  for (const token of qTokens) {
    if (
      tokenMatches(token, hay, hayWords, slugParts) ||
      tokenMatches(token, titleHay, haystackWords(titleHay), slugParts) ||
      tokenMatches(token, descriptionHay, haystackWords(descriptionHay), slugParts)
    ) {
      hits += 1;
    }
  }

  return hits / qTokens.length;
}

function listingPublishedAtMs(payload: ReturnType<typeof SkillListingPayloadSchema.parse>): number | null {
  const raw = payload.purchase?.publishedAt ?? payload.recordedAt;
  if (!raw) return null;
  const ms = Date.parse(String(raw));
  return Number.isNaN(ms) ? null : ms;
}

function matchesPublishedAtRange(
  payload: ReturnType<typeof SkillListingPayloadSchema.parse>,
  since?: number,
  until?: number,
): boolean {
  if (since == null && until == null) return true;
  const ms = listingPublishedAtMs(payload);
  if (ms == null) return true;
  if (since != null && ms < since) return false;
  if (until != null && ms > until) return false;
  return true;
}

export async function searchNaturalLanguage(
  query: string,
  filters: ListingFilters = {},
): Promise<QueryMatch[]> {
  const rows = await fetchListings(normalizeListingFilters(filters));
  const scored = rows.map((row) => ({
    row,
    score: query.trim()
      ? scoreSearch(query, {
          searchText: row.payload.searchText,
          skillName: row.payload.skillName,
          title: row.payload.title,
          description: row.payload.description,
        })
      : 1,
  }));

  if (query.trim()) {
    scored.sort((a, b) => b.score - a.score);
    const withHits = scored.filter((s) => s.score > 0);
    scored.length = 0;
    scored.push(...withHits);
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

export async function findListingBySkillSlug(skillSlug: string): Promise<{
  entityKey: Hex;
  version: number;
} | null> {
  const rows = await fetchListings({ skillSlug, limit: 1, scope: "mine" });
  if (!rows.length) return null;
  const entityKey = rows[0].entityKey as Hex;
  const next = await getNextVersionNumber(entityKey);
  const version = Math.max(1, next - 1);
  return { entityKey, version };
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
