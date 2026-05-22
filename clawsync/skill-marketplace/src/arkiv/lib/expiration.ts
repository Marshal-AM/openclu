import { ExpirationTime } from "@arkiv-network/sdk/utils";

export function listingExpiresIn(): number {
  const days = Number(process.env.ARKIV_LISTING_EXPIRES_DAYS ?? "180");
  return ExpirationTime.fromDays(days);
}

export function tagExpiresIn(): number {
  const days = Number(process.env.ARKIV_TAG_EXPIRES_DAYS ?? "180");
  return ExpirationTime.fromDays(days);
}

export function versionExpiresIn(): number {
  const days = Number(process.env.ARKIV_VERSION_EXPIRES_DAYS ?? "365");
  return ExpirationTime.fromDays(days);
}
