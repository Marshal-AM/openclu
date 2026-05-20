import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters } from "@arkiv-network/sdk";
import { ATTR, ENTITY_TYPE, PROJECT_ATTRIBUTE } from "../lib/constants.js";
import { versionExpiresIn } from "../lib/expiration.js";
import type { ListingVersionPayload } from "../lib/types.js";

export function buildVersionCreate(
  payload: ListingVersionPayload,
  publishedAtMs: number,
): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: ATTR.entityType, value: ENTITY_TYPE.listingVersion },
      { key: ATTR.listingKey, value: payload.listingKey },
      { key: ATTR.version, value: payload.version },
      { key: ATTR.publishedAt, value: publishedAtMs },
    ],
    expiresIn: versionExpiresIn(),
  };
}
