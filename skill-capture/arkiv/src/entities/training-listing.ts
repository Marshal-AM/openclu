import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import { ATTR, ENTITY_TYPE, LISTING_STATUS, PROJECT_ATTRIBUTE } from "../lib/constants.js";
import { listingExpiresIn } from "../lib/expiration.js";
import type { ListingStatus } from "../lib/constants.js";
import type { TrainingDataListingPayload } from "../lib/types.js";

export function trainingListingAttributes(
  skillSlug: string,
  status: ListingStatus,
  publishedAtMs: number,
  recordedAtMs: number,
) {
  return [
    PROJECT_ATTRIBUTE,
    { key: ATTR.entityType, value: ENTITY_TYPE.trainingDataListing },
    { key: ATTR.skillSlug, value: skillSlug },
    { key: ATTR.status, value: status },
    { key: ATTR.publishedAt, value: publishedAtMs },
    { key: ATTR.recordedAt, value: recordedAtMs },
    { key: ATTR.tagCursor, value: 0 },
  ];
}

export function buildTrainingListingCreate(
  payload: TrainingDataListingPayload,
): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: trainingListingAttributes(
      payload.skillName,
      LISTING_STATUS.published,
      Date.parse(payload.purchase.publishedAt) || Date.now(),
      payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now(),
    ),
    expiresIn: listingExpiresIn(),
  };
}

export function buildTrainingListingUpdate(
  entityKey: `0x${string}`,
  payload: TrainingDataListingPayload,
  status: ListingStatus = LISTING_STATUS.published,
): UpdateEntityParameters {
  return {
    entityKey,
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: trainingListingAttributes(
      payload.skillName,
      status,
      Date.parse(payload.purchase.publishedAt) || Date.now(),
      payload.recordedAt ? Date.parse(payload.recordedAt) : Date.now(),
    ),
    expiresIn: listingExpiresIn(),
  };
}
