import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters } from "@arkiv-network/sdk";
import { ATTR, ENTITY_TYPE, PROJECT_ATTRIBUTE } from "../lib/constants.js";
import { tagExpiresIn } from "../lib/expiration.js";
import type { SkillTagPayload } from "../lib/types.js";

export function buildTagCreate(
  payload: SkillTagPayload,
  publishedAtMs: number,
): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: [
      PROJECT_ATTRIBUTE,
      { key: ATTR.entityType, value: ENTITY_TYPE.skillTag },
      { key: ATTR.listingKey, value: payload.listingKey },
      { key: ATTR.tag, value: payload.tag },
      { key: ATTR.publishedAt, value: publishedAtMs },
    ],
    expiresIn: tagExpiresIn(),
  };
}
