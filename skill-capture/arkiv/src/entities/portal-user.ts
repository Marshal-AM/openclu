import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import {
  PORTAL_ATTR,
  PORTAL_ENTITY_TYPE,
  PORTAL_PROJECT_ATTRIBUTE,
} from "../lib/portal-constants.js";
import { portalUserExpiresIn } from "../lib/portal-expiration.js";
import type { PortalUserPayload } from "../lib/portal-types.js";

function userAttributes(payload: PortalUserPayload) {
  const updatedAtMs = Date.parse(payload.updatedAt) || Date.now();
  const createdAtMs = Date.parse(payload.createdAt) || updatedAtMs;
  return [
    PORTAL_PROJECT_ATTRIBUTE,
    { key: PORTAL_ATTR.entityType, value: PORTAL_ENTITY_TYPE.user },
    { key: PORTAL_ATTR.walletAddress, value: payload.walletAddress.toLowerCase() },
    { key: PORTAL_ATTR.createdAt, value: createdAtMs },
    { key: PORTAL_ATTR.updatedAt, value: updatedAtMs },
  ];
}

export function buildPortalUserCreate(payload: PortalUserPayload): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: userAttributes(payload),
    expiresIn: portalUserExpiresIn(),
  };
}

export function buildPortalUserUpdate(
  entityKey: `0x${string}`,
  payload: PortalUserPayload,
): UpdateEntityParameters {
  return {
    entityKey,
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: userAttributes(payload),
    expiresIn: portalUserExpiresIn(),
  };
}
