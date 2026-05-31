export function listingExpiresAt(): string {
  const days = Number(process.env.CATALOG_LISTING_EXPIRES_DAYS ?? "180");
  return new Date(Date.now() + days * 864e5).toISOString();
}

export function pendingRegistrationExpiresAt(): string {
  const hours = Number(process.env.PENDING_REGISTRATION_EXPIRES_HOURS ?? "24");
  return new Date(Date.now() + hours * 3600e3).toISOString();
}
