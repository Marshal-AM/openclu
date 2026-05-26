import { jsonToPayload } from "@arkiv-network/sdk/utils";
import type { CreateEntityParameters, UpdateEntityParameters } from "@arkiv-network/sdk";
import { PORTAL_ATTR, PORTAL_ENTITY_TYPE, PORTAL_PROJECT_ATTRIBUTE } from "./constants";
import {
  pendingRegistrationExpiresIn,
  portalDeviceExpiresIn,
  portalUserExpiresIn,
} from "./expiration";
import type {
  PendingRegistrationPayload,
  PortalDevicePayload,
  PortalUserPayload,
} from "./types";

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

function pendingAttributes(payload: PendingRegistrationPayload) {
  const createdAtMs = Date.parse(payload.createdAt) || Date.now();
  const expiresAtMs =
    Date.parse(payload.expiresAt) || createdAtMs + pendingRegistrationExpiresIn() * 1000;
  return [
    PORTAL_PROJECT_ATTRIBUTE,
    { key: PORTAL_ATTR.entityType, value: PORTAL_ENTITY_TYPE.pendingRegistration },
    { key: PORTAL_ATTR.registrationToken, value: payload.registrationToken },
    { key: PORTAL_ATTR.deviceWallet, value: payload.deviceWallet.toLowerCase() },
    { key: PORTAL_ATTR.createdAt, value: createdAtMs },
    { key: PORTAL_ATTR.expiresAt, value: expiresAtMs },
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
