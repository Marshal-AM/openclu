import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import { ATTR, ENTITY_TYPE, LISTING_STATUS, PROJECT_ATTRIBUTE } from "../lib/constants.js";
import { listingExpiresIn } from "../lib/expiration.js";
import type { ListingStatus } from "../lib/constants.js";
import type { SkillListingPayload } from "../lib/types.js";

export function listingAttributes(
  skillSlug: string,
  status: ListingStatus,
  publishedAtMs: number,
  recordedAtMs: number,
  tagCursor: boolean,
) {
  return [
    PROJECT_ATTRIBUTE,
    { key: ATTR.entityType, value: ENTITY_TYPE.skillListing },
    { key: ATTR.skillSlug, value: skillSlug },
    { key: ATTR.status, value: status },
    { key: ATTR.publishedAt, value: publishedAtMs },
    { key: ATTR.recordedAt, value: recordedAtMs },
    { key: ATTR.tagCursor, value: tagCursor ? 1 : 0 },
  ];
}

export function buildListingCreate(
  payload: SkillListingPayload,
  tagCursor = false,
): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: listingAttributes(
      payload.skillName,
      LISTING_STATUS.published,
      Date.parse(payload.purchase.publishedAt) || Date.now(),
      payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now(),
      tagCursor || payload.searchText.includes("cursor"),
    ),
    expiresIn: listingExpiresIn(),
  };
}

export function buildListingUpdate(
  entityKey: `0x${string}`,
  payload: SkillListingPayload,
  status: ListingStatus = LISTING_STATUS.published,
  tagCursor = false,
): UpdateEntityParameters {
  return {
    entityKey,
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: listingAttributes(
      payload.skillName,
      status,
      Date.parse(payload.purchase.publishedAt) || Date.now(),
      payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now(),
      tagCursor || payload.searchText.includes("cursor"),
    ),
    expiresIn: listingExpiresIn(),
  };
}
