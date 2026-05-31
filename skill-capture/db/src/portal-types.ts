import { z } from "zod";

export const PortalAvatarSchema = z.object({
  mimeType: z.string(),
  dataBase64: z.string(),
});

export const PortalUserPayloadSchema = z.object({
  walletAddress: z.string(),
  displayName: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatar: PortalAvatarSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().nullable().optional(),
});

export const PortalDevicePayloadSchema = z.object({
  portalId: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  deviceWallet: z.string(),
  ownerWallet: z.string(),
  registrationToken: z.string().nullable().optional(),
  registeredAt: z.string().nullable().optional(),
  orchestratorUrl: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const PendingRegistrationPayloadSchema = z.object({
  registrationToken: z.string(),
  deviceId: z.string(),
  deviceName: z.string(),
  deviceWallet: z.string(),
  orchestratorUrl: z.string().nullable().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type PortalAvatar = z.infer<typeof PortalAvatarSchema>;
export type PortalUserPayload = z.infer<typeof PortalUserPayloadSchema>;
export type PortalDevicePayload = z.infer<typeof PortalDevicePayloadSchema>;
export type PendingRegistrationPayload = z.infer<typeof PendingRegistrationPayloadSchema>;

export type PortalUserRow = PortalUserPayload & {
  entityKey: string;
  /** Public storage URL when avatar is in Supabase bucket. */
  avatarUrl?: string | null;
};
export type PortalDeviceRow = PortalDevicePayload & { entityKey: string };
export type PendingRegistrationRow = PendingRegistrationPayload & { entityKey: string };
