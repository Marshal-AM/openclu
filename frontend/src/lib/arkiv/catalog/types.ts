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

export const ListingOpsSchema = z
  .object({
    heliaPeerId: z.string().default(""),
    heliaMultiaddrs: z.array(z.string()).default([]),
    encryptedSizeBytes: z.number(),
    readConditionAddress: z.string(),
    writeConditionAddress: z.string(),
    licenseTokenAddress: z.string(),
    storyApiUrl: z.string(),
    rpcUrl: z.string(),
    ipfsGatewayUrl: z.string().url().optional(),
    contentRegistryBaseUrl: z.string().url().optional(),
  })
  .refine(
    (o) =>
      Boolean(o.ipfsGatewayUrl?.trim()) ||
      (o.heliaPeerId.trim().length > 0 && o.heliaMultiaddrs.length > 0),
    { message: "ops need ipfsGatewayUrl or helia peer hints" },
  );

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

export const TrainingDataListingPayloadSchema = SkillListingPayloadSchema.extend({
  contentKind: z.literal("trainingData"),
  videoMime: z.string(),
});

export type PurchaseInfo = z.infer<typeof PurchaseInfoSchema>;
export type SkillListingPayload = z.infer<typeof SkillListingPayloadSchema>;
export type TrainingDataListingPayload = z.infer<typeof TrainingDataListingPayloadSchema>;

export type QueryMatch = {
  score: number;
  entityKey: string;
  skillName: string;
  title: string;
  description: string;
  triggers: string[];
  purchase: PurchaseInfo;
  listingKey: string;
  status: string;
  owner?: string;
  creator?: string;
  payload?: SkillListingPayload;
  tags?: string[];
  arkivVersion?: number;
};
