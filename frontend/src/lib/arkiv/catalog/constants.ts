export const CATALOG_PROJECT_ATTRIBUTE = {
  key: "project",
  value: process.env.ARKIV_PROJECT_VALUE ?? "skill-capture-ai-catalog-v1",
} as const;

export const CATALOG_ENTITY_TYPE = {
  skillListing: "skillListing",
  trainingDataListing: "trainingDataListing",
  skillTag: "skillTag",
  listingVersion: "listingVersion",
} as const;

export const LISTING_STATUS = {
  draft: "draft",
  published: "published",
  archived: "archived",
} as const;

export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

export const CATALOG_ATTR = {
  entityType: "entityType",
  skillSlug: "skillSlug",
  listingKey: "listingKey",
  status: "status",
  tag: "tag",
  publishedAt: "publishedAt",
  recordedAt: "recordedAt",
  tagCursor: "tagCursor",
  version: "version",
} as const;
