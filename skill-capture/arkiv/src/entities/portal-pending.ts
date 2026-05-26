import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import {
  PORTAL_ATTR,
  PORTAL_ENTITY_TYPE,
  PORTAL_PROJECT_ATTRIBUTE,
} from "../lib/portal-constants.js";
import { pendingRegistrationExpiresIn } from "../lib/portal-expiration.js";
import type { PendingRegistrationPayload } from "../lib/portal-types.js";

function pendingAttributes(payload: PendingRegistrationPayload) {
  const createdAtMs = Date.parse(payload.createdAt) || Date.now();
  const expiresAtMs = Date.parse(payload.expiresAt) || createdAtMs + pendingRegistrationExpiresIn() * 1000;
  return [
    PORTAL_PROJECT_ATTRIBUTE,
    { key: PORTAL_ATTR.entityType, value: PORTAL_ENTITY_TYPE.pendingRegistration },
    { key: PORTAL_ATTR.registrationToken, value: payload.registrationToken },
    { key: PORTAL_ATTR.deviceWallet, value: payload.deviceWallet.toLowerCase() },
    { key: PORTAL_ATTR.createdAt, value: createdAtMs },
    { key: PORTAL_ATTR.expiresAt, value: expiresAtMs },
  ];
}

export function buildPendingRegistrationCreate(
  payload: PendingRegistrationPayload,
): CreateEntityParameters {
  return {
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: pendingAttributes(payload),
    expiresIn: pendingRegistrationExpiresIn(),
  };
}

export function buildPendingRegistrationUpdate(
  entityKey: `0x${string}`,
  payload: PendingRegistrationPayload,
): UpdateEntityParameters {
  return {
    entityKey,
    payload: jsonToPayload(payload),
    contentType: "application/json",
    attributes: pendingAttributes(payload),
    expiresIn: pendingRegistrationExpiresIn(),
  };
}
