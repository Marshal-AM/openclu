import {
  deletePendingRegistration,
  getPendingRegistration,
  getPortalDevice,
  getPortalDeviceOrchestratorUrl,
  getPortalUserAvatar,
  getPortalUserProfile,
  listDevicesForOwner,
  updatePortalDevice,
  upsertPendingRegistration,
  upsertPortalDevice,
  upsertPortalUserAvatar,
  upsertPortalUserProfile,
} from "@/lib/supabase/portal";

export type PortalDeviceRow = Awaited<
  ReturnType<typeof listDevicesForOwner>
>["devices"][number];
export type PortalProfile = Awaited<ReturnType<typeof getPortalUserProfile>>["profile"];
export type PendingRegistrationRow = NonNullable<
  Awaited<ReturnType<typeof getPendingRegistration>>["pending"]
>;

export {
  deletePendingRegistration,
  getPendingRegistration,
  getPortalDevice,
  getPortalDeviceOrchestratorUrl,
  getPortalUserAvatar,
  getPortalUserProfile,
  listDevicesForOwner,
  listDevicesForOwner as listPortalDevices,
  updatePortalDevice,
  upsertPendingRegistration,
  upsertPortalDevice,
  upsertPortalUserAvatar,
  upsertPortalUserProfile,
};
