import { eq, and, desc } from "@arkiv-network/sdk/query";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { createPortalPublicClient, normalizeWalletAddress } from "../lib/portal-client.js";
import {
  PORTAL_ATTR,
  PORTAL_ENTITY_TYPE,
  PORTAL_PROJECT_ATTRIBUTE,
} from "../lib/portal-constants.js";
import {
  PendingRegistrationPayloadSchema,
  PortalDevicePayloadSchema,
  PortalUserPayloadSchema,
  type PendingRegistrationRow,
  type PortalDeviceRow,
  type PortalUserRow,
} from "../lib/portal-types.js";

function parseEntityPayload<T>(
  entity: Entity,
  schema: { parse: (v: unknown) => T },
): T {
  return schema.parse(entity.toJson());
}

function toUserRow(entity: Entity): PortalUserRow {
  return {
    ...parseEntityPayload(entity, PortalUserPayloadSchema),
    entityKey: entity.key,
  };
}

function toDeviceRow(entity: Entity): PortalDeviceRow {
  return {
    ...parseEntityPayload(entity, PortalDevicePayloadSchema),
    entityKey: entity.key,
  };
}

function toPendingRow(entity: Entity): PendingRegistrationRow {
  return {
    ...parseEntityPayload(entity, PendingRegistrationPayloadSchema),
    entityKey: entity.key,
  };
}

function basePredicates(entityType: string) {
  return [
    eq(PORTAL_PROJECT_ATTRIBUTE.key, PORTAL_PROJECT_ATTRIBUTE.value),
    eq(PORTAL_ATTR.entityType, entityType),
  ];
}

export async function fetchPortalUser(walletAddress: string): Promise<PortalUserRow | null> {
  const wallet = normalizeWalletAddress(walletAddress);
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(and([...basePredicates(PORTAL_ENTITY_TYPE.user), eq(PORTAL_ATTR.walletAddress, wallet)]))
    .withPayload(true)
    .withAttributes(true)
    .limit(1)
    .fetch();
  const entity = result.entities[0];
  return entity ? toUserRow(entity) : null;
}

export async function fetchPortalDevicesForOwner(ownerWallet: string): Promise<PortalDeviceRow[]> {
  const owner = normalizeWalletAddress(ownerWallet);
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(and([...basePredicates(PORTAL_ENTITY_TYPE.device), eq(PORTAL_ATTR.ownerWallet, owner)]))
    .withPayload(true)
    .withAttributes(true)
    .orderBy(desc(PORTAL_ATTR.createdAt, "number"))
    .fetch();
  return result.entities.map(toDeviceRow);
}

export async function fetchPortalDeviceByPortalId(
  ownerWallet: string,
  portalId: string,
): Promise<PortalDeviceRow | null> {
  const owner = normalizeWalletAddress(ownerWallet);
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(
      and([
        ...basePredicates(PORTAL_ENTITY_TYPE.device),
        eq(PORTAL_ATTR.ownerWallet, owner),
        eq(PORTAL_ATTR.portalId, portalId),
      ]),
    )
    .withPayload(true)
    .withAttributes(true)
    .limit(1)
    .fetch();
  const entity = result.entities[0];
  return entity ? toDeviceRow(entity) : null;
}

export async function fetchPortalDeviceByDeviceWallet(
  deviceWallet: string,
): Promise<PortalDeviceRow | null> {
  const wallet = normalizeWalletAddress(deviceWallet);
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(and([...basePredicates(PORTAL_ENTITY_TYPE.device), eq(PORTAL_ATTR.deviceWallet, wallet)]))
    .withPayload(true)
    .withAttributes(true)
    .limit(1)
    .fetch();
  const entity = result.entities[0];
  return entity ? toDeviceRow(entity) : null;
}

export async function fetchPendingRegistrationByToken(
  registrationToken: string,
): Promise<PendingRegistrationRow | null> {
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(
      and([
        ...basePredicates(PORTAL_ENTITY_TYPE.pendingRegistration),
        eq(PORTAL_ATTR.registrationToken, registrationToken),
      ]),
    )
    .withPayload(true)
    .withAttributes(true)
    .limit(1)
    .fetch();
  const entity = result.entities[0];
  return entity ? toPendingRow(entity) : null;
}

export async function fetchPendingRegistrationByDeviceWallet(
  deviceWallet: string,
): Promise<PendingRegistrationRow | null> {
  const wallet = normalizeWalletAddress(deviceWallet);
  const result = await createPortalPublicClient()
    .buildQuery()
    .where(
      and([
        ...basePredicates(PORTAL_ENTITY_TYPE.pendingRegistration),
        eq(PORTAL_ATTR.deviceWallet, wallet),
      ]),
    )
    .withPayload(true)
    .withAttributes(true)
    .limit(1)
    .fetch();
  const entity = result.entities[0];
  return entity ? toPendingRow(entity) : null;
}

export async function fetchPendingRegistrationEntityKey(
  registrationToken: string,
): Promise<Hex | null> {
  const row = await fetchPendingRegistrationByToken(registrationToken);
  return row ? (row.entityKey as Hex) : null;
}
