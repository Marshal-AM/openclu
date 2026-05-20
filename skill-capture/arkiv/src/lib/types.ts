import { z } from "zod";

export const PurchaseInfoSchema = z.object({
  vaultUuid: z.number(),
  ipId: z.string(),
  licenseTermsId: z.string(),
  cid: z.string(),
  mintingFeeIp: z.string(),
  network: z.string(),
  publishedAt: z.string(),
  publisherAddress: z.string(),
});

export const ListingOpsSchema = z.object({
  heliaPeerId: z.string(),
  heliaMultiaddrs: z.array(z.string()),
  encryptedSizeBytes: z.number(),
  readConditionAddress: z.string(),
  writeConditionAddress: z.string(),
  licenseTokenAddress: z.string(),
  storyApiUrl: z.string(),
  rpcUrl: z.string(),
});

export const SkillListingPayloadSchema = z.object({
  skillName: z.string(),
  title: z.string(),
  description: z.string(),
  expertiseSource: z.string().optional(),
  recordedAt: z.string().optional(),
  searchText: z.string(),
  triggers: z.array(z.string()).default([]),
  purchase: PurchaseInfoSchema,
  ops: ListingOpsSchema.optional(),
  triggerCount: z.number(),
});

export const SkillTagPayloadSchema = z.object({
  listingKey: z.string(),
  skillSlug: z.string(),
  tag: z.string(),
  label: z.string(),
});

export const ListingVersionPayloadSchema = z.object({
  listingKey: z.string(),
  skillSlug: z.string(),
  version: z.number(),
  vaultUuid: z.number(),
  ipId: z.string(),
  licenseTermsId: z.string(),
  cid: z.string(),
  publishedAt: z.string(),
  txNote: z.string().optional(),
});

export type PurchaseInfo = z.infer<typeof PurchaseInfoSchema>;
export type ListingOps = z.infer<typeof ListingOpsSchema>;
export type SkillListingPayload = z.infer<typeof SkillListingPayloadSchema>;
export type SkillTagPayload = z.infer<typeof SkillTagPayloadSchema>;
export type ListingVersionPayload = z.infer<typeof ListingVersionPayloadSchema>;

export interface HeliaPeerHints {
  helia_peer_id: string;
  helia_multiaddrs: string[];
}

export interface PublishCatalogOpsInput {
  peerHints: HeliaPeerHints;
  encryptedSizeBytes: number;
  readConditionAddress: string;
  writeConditionAddress: string;
  licenseTokenAddress: string;
  storyApiUrl: string;
  rpcUrl: string;
}

export interface CdrManifest {
  skillName: string;
  vaultUuid: number;
  ipId: string;
  licenseTermsId: string;
  cid: string;
  mintingFeeIp?: string;
  publishedAt: string;
  network?: string;
  bundlePath?: string;
  arkivListingKey?: string;
  arkivStatus?: string;
  arkivVersion?: number;
}

export interface PublishCatalogResult {
  listingKey: string;
  status: "published";
  version: number;
  tagCount: number;
  tags: string[];
  /** Tags + version entity mutation. */
  txHash: string;
  /** Listing create/update mutation (update path may omit). */
  listingTxHash?: string;
  chainId: number;
  chainName: string;
  publisherAddress: string;
  explorerBaseUrl: string;
  urls: {
    entitiesTx: string;
    listingTx?: string;
  };
  /** Full indexed payload after write (for CLI / debugging). */
  catalogPayload?: SkillListingPayload;
}

export interface QueryMatch {
  score: number;
  entityKey: string;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  purchase: PurchaseInfo;
  listingKey: string;
  status: string;
}
