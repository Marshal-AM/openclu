import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import {
  PORTAL_ATTR,
  PORTAL_ENTITY_TYPE,
  PORTAL_PROJECT_ATTRIBUTE,
} from "../lib/portal-constants.js";
import { portalDeviceExpiresIn } from "../lib/portal-expiration.js";
import type { PortalDevicePayload } from "../lib/portal-types.js";

function deviceAttributes(payload: PortalDevicePayload) {
  const createdAtMs = Date.parse(payload.createdAt) || Date.now();
  return [
    PORTAL_PROJECT_ATTRIBUTE,
    { key: PORTAL_ATTR.entityType, value: PORTAL_ENTITY_TYPE.device },
    { key: PORTAL_ATTR.portalId, value: payload.portalId },
    { key: PORTAL_ATTR.deviceId, value: payload.deviceId },
    { key: PORTAL_ATTR.ownerWallet, value: payload.ownerWallet.toLowerCase() },
    { key: PORTAL_ATTR.deviceWallet, value: payload.deviceWallet.toLowerCase() },
    { key: PORTAL_ATTR.createdAt, value: createdAtMs },
  ];
}

export function buildPortalDeviceCreate(payload: PortalDevicePayload): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: deviceAttributes(payload),
    expiresIn: portalDeviceExpiresIn(),
  };
}

export function buildPortalDeviceUpdate(
  entityKey: `0x${string}`,
  payload: PortalDevicePayload,
): UpdateEntityParameters {
  return {
    entityKey,
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: deviceAttributes(payload),
    expiresIn: portalDeviceExpiresIn(),
  };
}
