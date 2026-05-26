import { ExpirationTime } from "@arkiv-network/sdk/utils";

export function portalUserExpiresIn(): number {
  const days = Number(process.env.ARKIV_PORTAL_USER_EXPIRES_DAYS ?? "365");
  return ExpirationTime.fromDays(days);
}

export function portalDeviceExpiresIn(): number {
  const days = Number(process.env.ARKIV_PORTAL_DEVICE_EXPIRES_DAYS ?? "365");
  return ExpirationTime.fromDays(days);
}

export function pendingRegistrationExpiresIn(): number {
  const hours = Number(process.env.ARKIV_PENDING_REGISTRATION_EXPIRES_HOURS ?? "24");
  return ExpirationTime.fromHours(hours);
}
