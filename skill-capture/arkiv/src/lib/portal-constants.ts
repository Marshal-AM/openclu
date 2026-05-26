export const PORTAL_PROJECT_ATTRIBUTE = {
  key: "project",
  value: process.env.ARKIV_PORTAL_PROJECT_VALUE ?? "openclu-portal-v1",
} as const;

export const PORTAL_ENTITY_TYPE = {
  user: "portalUser",
  device: "portalDevice",
  pendingRegistration: "deviceRegistrationPending",
} as const;

export const PORTAL_ATTR = {
  entityType: "entityType",
  walletAddress: "walletAddress",
  ownerWallet: "ownerWallet",
  deviceWallet: "deviceWallet",
  portalId: "portalId",
  deviceId: "deviceId",
  registrationToken: "registrationToken",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  expiresAt: "expiresAt",
} as const;
